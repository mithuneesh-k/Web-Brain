const runBtn = document.getElementById('runBtn');
const promptInput = document.getElementById('prompt');
const resultContainer = document.getElementById('resultContainer');
const loader = document.getElementById('loader');
const btnText = document.getElementById('btnText');

runBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  // UI Loading State
  runBtn.disabled = true;
  btnText.style.display = 'none';
  loader.style.display = 'block';
  resultContainer.style.display = 'none';
  
  chrome.runtime.sendMessage({ type: "run_agent", prompt }, (response) => {
    // Reset UI State
    runBtn.disabled = false;
    btnText.style.display = 'block';
    loader.style.display = 'none';
    resultContainer.style.display = 'block';

    if (chrome.runtime.lastError) {
       resultContainer.innerHTML = `<span style="color: #ef4444;">Error:</span> ${chrome.runtime.lastError.message}`;
    } else if (response && response.error) {
       resultContainer.innerHTML = `<span style="color: #ef4444;">Error:</span> ${response.error}`;
    } else {
       resultContainer.innerHTML = `<span style="color: #10b981;">Success:</span> ${response ? response.result : "Done"}`;
    }
  });
});

// Allow Enter key to submit without newline
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    runBtn.click();
  }
});
