// scratch/find-node-ports.js
const { execSync } = require('child_process');

try {
  console.log('🔍 Analizando puertos y procesos en ejecución...');

  // 1. Obtener la lista de procesos de Node.js
  const tasklistOut = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8' });
  const nodePids = [];
  
  tasklistOut.split('\n').forEach(line => {
    const parts = line.split('","');
    if (parts.length > 1) {
      const pidStr = parts[1].replace(/"/g, '').trim();
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) nodePids.push(pid);
    }
  });

  if (nodePids.length === 0) {
    console.log('⚠️ No hay procesos node.exe activos.');
    process.exit(0);
  }

  // 2. Buscar puertos en escucha para esos PIDs
  const netstatOut = execSync('netstat -ano', { encoding: 'utf8' });
  const results = [];

  netstatOut.split('\n').forEach(line => {
    if (line.includes('LISTENING')) {
      const tokens = line.trim().split(/\s+/);
      // Estructura: [ 'TCP', '0.0.0.0:3000', '0.0.0.0:0', 'LISTENING', '6344' ]
      if (tokens.length >= 5) {
        const localAddr = tokens[1];
        const pid = parseInt(tokens[4], 10);
        
        if (nodePids.includes(pid)) {
          const port = localAddr.split(':').pop();
          results.push({
            PID: pid,
            Puerto: port,
            Proceso: 'node.exe'
          });
        }
      }
    }
  });

  if (results.length > 0) {
    console.log('\n✅ PUERTOS DONDE CORRE NODE.EXE:');
    console.table(results);
  } else {
    console.log('⚠️ Node.exe está activo pero no parece tener puertos en escucha abiertos en este momento.');
  }

} catch (err) {
  console.error('Error:', err.message);
}
