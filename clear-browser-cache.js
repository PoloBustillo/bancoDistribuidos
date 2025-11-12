// 🔧 SCRIPT DE LIMPIEZA PARA VERCEL
// Ejecuta esto en la consola del navegador (F12) en https://banco-distribuidos.vercel.app

console.log('🧹 Limpiando localStorage...');

// Limpiar todo el localStorage
localStorage.clear();

// Limpiar sessionStorage también
sessionStorage.clear();

// Limpiar cookies (si hay)
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

console.log('✅ localStorage limpiado');
console.log('🔄 Recargando página...');

// Recargar la página
location.reload(true);
