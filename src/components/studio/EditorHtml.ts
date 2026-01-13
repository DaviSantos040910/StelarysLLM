export const EDITOR_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  body {
    background-color: #020617; /* space-dark */
    color: #e2e8f0; /* starlight/text */
    font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu;
    font-size: 18px;
    margin: 0;
    padding: 16px;
  }
  #editor {
    outline: none;
    min-height: 300px;
    line-height: 1.5;
  }
  /* Placeholder logic */
  [contenteditable]:empty:before {
    content: attr(placeholder);
    color: #64748b;
    display: block; /* For Firefox */
  }
</style>
</head>
<body>
<div id="editor" contenteditable="true" placeholder="Escreva sua nota aqui..."></div>

<script>
  var editor = document.getElementById('editor');

  // Handle messages from React Native
  document.addEventListener("message", function(event) {
    handleMessage(event.data);
  });
  window.addEventListener("message", function(event) {
    handleMessage(event.data);
  });

  function handleMessage(dataStr) {
    try {
      var data = JSON.parse(dataStr);
      if (data.type === 'format') {
        document.execCommand(data.command, false, data.value || null);
      }
      if (data.type === 'init') {
        editor.innerHTML = data.content || '';
      }
    } catch(e) {
      // ignore
    }
  }

  // Send updates to React Native
  editor.addEventListener('input', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'change',
      content: editor.innerHTML
    }));
  });

  // Focus listener to manage keyboard if needed
  editor.addEventListener('focus', function() {
     // optional: notify RN focused
  });

  // Listen for selection changes to update toolbar state
  document.addEventListener('selectionchange', function() {
    var styles = [];
    if (document.queryCommandState('bold')) styles.push('bold');
    if (document.queryCommandState('italic')) styles.push('italic');
    // Send state back to RN
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'selection',
      styles: styles
    }));
  });

</script>
</body>
</html>
`;
