import { logger } from "@banco/shared/logger";
import type { LockQueueEntry } from "./types";

// ========================================
// 🔍 DETECCIÓN DE DEADLOCKS
// ========================================
// Implementa detección de ciclos en el grafo wait-for
// para identificar y resolver deadlocks entre workers
// ========================================

interface WaitForEdge {
  esperando: string; // workerId que espera
  bloqueadoPor: string; // workerId que tiene el lock
  recurso: string; // recurso en conflicto
  timestamp: number;
}

export class DeadlockDetector {
  private grafoWaitFor: Map<string, WaitForEdge[]> = new Map();
  private deadlocksDetectados = 0;
  private deadlocksResueltos = 0;

  /**
   * Registra una relación de espera (A espera por B)
   */
  registrarEspera(
    workerEsperando: string,
    workerBloqueador: string,
    recurso: string
  ): void {
    if (!this.grafoWaitFor.has(workerEsperando)) {
      this.grafoWaitFor.set(workerEsperando, []);
    }

    const edge: WaitForEdge = {
      esperando: workerEsperando,
      bloqueadoPor: workerBloqueador,
      recurso,
      timestamp: Date.now(),
    };

    this.grafoWaitFor.get(workerEsperando)!.push(edge);
  }

  /**
   * Elimina una relación de espera cuando se concede o cancela un lock
   */
  eliminarEspera(workerEsperando: string, recurso?: string): void {
    if (!this.grafoWaitFor.has(workerEsperando)) return;

    if (recurso) {
      // Eliminar solo espera por recurso específico
      const edges = this.grafoWaitFor.get(workerEsperando)!;
      this.grafoWaitFor.set(
        workerEsperando,
        edges.filter((e) => e.recurso !== recurso)
      );
    } else {
      // Eliminar todas las esperas del worker
      this.grafoWaitFor.delete(workerEsperando);
    }
  }

  /**
   * Detecta ciclos en el grafo wait-for usando DFS
   * Retorna el ciclo detectado o null
   */
  detectarDeadlock(): string[] | null {
    const visitados = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodo: string, camino: string[]): string[] | null => {
      if (stack.has(nodo)) {
        // Ciclo detectado
        const cicloInicio = camino.indexOf(nodo);
        return camino.slice(cicloInicio);
      }

      if (visitados.has(nodo)) {
        return null;
      }

      visitados.add(nodo);
      stack.add(nodo);
      camino.push(nodo);

      const edges = this.grafoWaitFor.get(nodo) || [];
      for (const edge of edges) {
        const ciclo = dfs(edge.bloqueadoPor, [...camino]);
        if (ciclo) {
          this.deadlocksDetectados++;
          return ciclo;
        }
      }

      stack.delete(nodo);
      return null;
    };

    // Buscar ciclos desde cada nodo no visitado
    for (const nodo of this.grafoWaitFor.keys()) {
      const ciclo = dfs(nodo, []);
      if (ciclo) {
        logger.warn(
          `🔴 DEADLOCK DETECTADO: ${ciclo.join(" -> ")} -> ${ciclo[0]}`,
          {
            ciclo,
            deadlocksTotal: this.deadlocksDetectados,
          }
        );
        return ciclo;
      }
    }

    return null;
  }

  /**
   * Selecciona la víctima para resolver el deadlock
   * Criterios: menor prioridad, menos locks activos, más reciente
   */
  seleccionarVictima(
    ciclo: string[],
    cola: LockQueueEntry[]
  ): LockQueueEntry | null {
    // Encontrar requests en cola de los workers del ciclo
    const candidatos = cola.filter((entry) =>
      ciclo.includes(entry.request.workerId)
    );

    if (candidatos.length === 0) return null;

    // Ordenar por: prioridad (asc), reintentos (desc), timestamp (desc)
    candidatos.sort((a, b) => {
      // Menor prioridad primero
      if (a.request.prioridad !== b.request.prioridad) {
        return a.request.prioridad - b.request.prioridad;
      }
      // Más reintentos primero (ha intentado más veces)
      if (a.reintentos !== b.reintentos) {
        return b.reintentos - a.reintentos;
      }
      // Más reciente primero (menos tiempo esperando)
      return b.timestamp - a.timestamp;
    });

    return candidatos[0];
  }

  /**
   * Resuelve un deadlock cancelando el request seleccionado
   */
  resolverDeadlock(victima: LockQueueEntry): void {
    this.deadlocksResueltos++;
    this.eliminarEspera(victima.request.workerId);

    logger.warn(
      `🩹 Deadlock resuelto cancelando request de ${victima.request.workerId}`,
      {
        workerId: victima.request.workerId,
        operacion: victima.request.operacion,
        requestId: victima.request.requestId,
        deadlocksResueltos: this.deadlocksResueltos,
      }
    );
  }

  /**
   * Limpia edges antiguos (>5 minutos) que ya no son relevantes
   */
  limpiarEdgesAntiguos(): void {
    const maxAge = 5 * 60 * 1000; // 5 minutos
    const ahora = Date.now();
    let limpiados = 0;

    for (const [worker, edges] of this.grafoWaitFor) {
      const edgesActualizados = edges.filter(
        (edge) => ahora - edge.timestamp < maxAge
      );
      limpiados += edges.length - edgesActualizados.length;

      if (edgesActualizados.length === 0) {
        this.grafoWaitFor.delete(worker);
      } else {
        this.grafoWaitFor.set(worker, edgesActualizados);
      }
    }

    if (limpiados > 0) {
      logger.lock(`Limpiados ${limpiados} edges antiguos del grafo wait-for`);
    }
  }

  /**
   * Obtiene estadísticas del detector
   */
  getEstadisticas() {
    return {
      workersEnEspera: this.grafoWaitFor.size,
      relacionesEspera: Array.from(this.grafoWaitFor.values()).reduce(
        (sum, edges) => sum + edges.length,
        0
      ),
      deadlocksDetectados: this.deadlocksDetectados,
      deadlocksResueltos: this.deadlocksResueltos,
    };
  }

  /**
   * Resetea el grafo (para testing o debug)
   */
  reset(): void {
    this.grafoWaitFor.clear();
  }
}
