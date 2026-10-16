// kill() requests termination; Windows can retain the working-directory lock
// until the process has exited and its stdio handles have closed.
export async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('App did not exit within 10 seconds')), 10000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.kill();
  });
}
