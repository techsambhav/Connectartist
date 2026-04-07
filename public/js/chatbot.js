// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Inject HTML structure for the chatbot if it doesn't exist
  if (!document.getElementById('chat-widget')) {
    const chatHTML = `
      <div id="chat-widget">
        <!-- Floating Button -->
        <button id="chat-launcher" aria-label="Open Chat">
          <i class="fas fa-comment-dots"></i>
        </button>

        <!-- Chat Window -->
        <div id="chat-window">
          <div id="chat-header">
            <h3><i class="fas fa-robot"></i> ConnectArtist AI</h3>
            <button id="chat-close-btn" aria-label="Close Chat">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div id="chat-messages">
            <div class="chat-msg bot">Hi there! 👋 I'm the ConnectArtist Assistant. How can I help you today?</div>
          </div>
          
          <div class="chat-typing" id="chat-typing-indicator">
            <span></span><span></span><span></span>
          </div>

          <div id="chat-input-area">
            <input type="text" id="chat-input" placeholder="Type your message..." autocomplete="off">
            <button id="chat-send-btn" aria-label="Send Message">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);
  }

  // DOM Elements
  const launcher = document.getElementById('chat-launcher');
  const chatWindow = document.getElementById('chat-window');
  const closeBtn = document.getElementById('chat-close-btn');
  const messageArea = document.getElementById('chat-messages');
  const inputField = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const typingIndicator = document.getElementById('chat-typing-indicator');
  const launcherIcon = launcher.querySelector('i');

  // Chat History state
  let chatHistory = [];

  // Toggle Chat Window
  function toggleChat() {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open')) {
      launcherIcon.classList.remove('fa-comment-dots');
      launcherIcon.classList.add('fa-times');
      setTimeout(() => inputField.focus(), 300);
    } else {
      launcherIcon.classList.remove('fa-times');
      launcherIcon.classList.add('fa-comment-dots');
    }
  }

  launcher.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', () => {
    chatWindow.classList.remove('open');
    launcherIcon.classList.remove('fa-times');
    launcherIcon.classList.add('fa-comment-dots');
  });

  // Basic markdown parser
  function parseMarkdown(text) {
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // bold
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>'); // italic
    parsed = parsed.replace(/\n\n/g, '<br><br>'); // para
    parsed = parsed.replace(/\n/g, '<br>'); // line break
    return parsed;
  }

  // Render a message
  function addMessage(text, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg ' + sender;
    msgDiv.innerHTML = parseMarkdown(text);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  // Handle Send
  async function sendMessage() {
    const text = inputField.value.trim();
    if (!text) return;

    // Display user message
    addMessage(text, 'user');
    inputField.value = '';
    
    // Add to history
    chatHistory.push({ role: 'user', text: text });

    // Show loading
    typingIndicator.style.display = 'flex';
    messageArea.appendChild(typingIndicator); // move to bottom
    messageArea.scrollTop = messageArea.scrollHeight;
    
    inputField.disabled = true;
    sendBtn.disabled = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          history: chatHistory
        })
      });

      const data = await response.json();

      if (data.success && data.reply) {
        addMessage(data.reply, 'bot');
        chatHistory.push({ role: 'ai', text: data.reply });
      } else {
        addMessage(data.error || 'Oops, I encountered an error. Please try again later.', 'bot');
      }
    } catch (err) {
      console.error('Chat Error:', err);
      addMessage('Sorry, I am having trouble connecting to my server right now.', 'bot');
    } finally {
      typingIndicator.style.display = 'none';
      inputField.disabled = false;
      sendBtn.disabled = false;
      inputField.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Make the widget accessible globally for other scripts if needed
  window.ConnectArtistChat = {
    open: toggleChat
  };
});
