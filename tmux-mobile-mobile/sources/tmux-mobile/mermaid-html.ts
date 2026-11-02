export function mermaidHtml(source: string): string {
  // Diagram text is data, including literal </script> and Unicode separators.
  const encoded = JSON.stringify(source).replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src https://cdn.jsdelivr.net">
<style>body{margin:8px;background:white;color:#222;font-family:system-ui}svg{width:100%;height:auto}#error{white-space:pre-wrap}</style></head>
<body><div id="diagram"></div><div id="error"></div><script type="module">
const send = value => window.ReactNativeWebView?.postMessage(JSON.stringify(value));
try {
  const {default: mermaid} = await import('https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs');
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',suppressErrorRendering:true});
  const {svg} = await mermaid.render('native-mermaid', ${encoded});
  document.getElementById('diagram').innerHTML = svg;
  send({height:document.documentElement.scrollHeight,ready:true});
} catch (error) {
  document.getElementById('error').textContent = 'Diagram could not be rendered.';
  send({error:String(error.message || error)});
}
</script></body></html>`;
}
