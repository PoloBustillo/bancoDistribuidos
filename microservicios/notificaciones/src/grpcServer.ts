import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";
import { sendNotification } from "./services/notifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_PATH = path.join(__dirname, "proto", "notificaciones.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {});
const proto: any = grpc.loadPackageDefinition(packageDefinition).notificaciones;

const server = new grpc.Server();

server.addService(proto.NotificacionesService.service, {
  EnviarNotificacion: async (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const { to, subject, message } = call.request;
    try {
      await sendNotification(to, subject, message);
      callback(null, { success: true, error: "" });
    } catch (err: any) {
      callback(null, { success: false, error: err.message || "Error" });
    }
  },
});

export function startGrpcServer(port = 50051) {
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, bindPort) => {
      if (err) throw err;
      server.start();
      console.log(`gRPC server listening on port ${bindPort}`);
    }
  );
}
