const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

// Initialize the Google Generative AI client only if the key is present
const initGenAI = () => {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-1.5-flash as it is fast and efficient for standard chat tasks
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
};

const CHAT_SYSTEM_PROMPT = `
You are the official ConnectArtist AI Assistant.
Your personality is friendly, professional, enthusiastic, and helpful.
ConnectArtist is a platform that empowers artists of all disciplines (musicians, magicians, comedians, dancers, painters, etc.) to showcase their talent and connect with audiences, reducing reliance on middlemen.
You help event organizers find the perfect artist for their events safely and securely.

Key Platform Features for you to know:
- Event Organizers can browse artists, check their availability, and secure bookings.
- The platform uses a secure Escrow system for payments to ensure artists get paid and organizers are protected.
- Artists can manage their profiles, showcase media, and set their booking fees.

If a user asks how to book an artist: Tell them to browse the Discovery page to find an artist, check their available dates, and click "Book Now" to send a booking request.

Keep your answers concise, well-formatted (use markdown for bolding/bullet points), and directly address the user's question. If you don't know something about the platform, apologize and say you're still learning. Do not answer questions completely unrelated to artists, events, or the ConnectArtist platform.
`;

const handleChatMessage = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        initGenAI();

        if (!model) {
            return res.status(503).json({ 
                success: false, 
                error: 'AI Chat is currently unavailable. (Missing API Key)' 
            });
        }

        // Convert the frontend history format to the Gemini history format
        const formattedHistory = [];
        // Add the system instructions as the first message context
        formattedHistory.push({
            role: "user",
            parts: [{ text: "SYSTEM INSTRUCTIONS: " + CHAT_SYSTEM_PROMPT }]
        });
        formattedHistory.push({
            role: "model",
            parts: [{ text: "Understood. I am the ConnectArtist Assistant." }]
        });

        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                formattedHistory.push({
                    role: msg.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: msg.text }]
                });
            });
        }

        // Start chat session
        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
            },
        });

        // Send user message
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        return res.json({
            success: true,
            reply: responseText
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to process chat message. Please try again later.' 
        });
    }
};

module.exports = {
    handleChatMessage
};
