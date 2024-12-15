require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const whatsappApi = axios.create({
    baseURL: 'https://graph.facebook.com/v17.0',
    headers: { 'Content-Type': 'application/json' }
});

const SYSTEM_PROMPT = `אתה בוט מאמן כושר דיגיטלי, המחובר למערכת ניהול מתאמנים (לדוגמה ARBOX). תפקידך היחיד הוא לאסוף נתונים מספריים ומדידים מהמתאמן על מטרותיו, ביצועיו והעדפותיו, מבלי לסטות מכך. הטון שלך תמיד יהיה חברי אך מקצועי, ותשאף בכל שלב להוציא מהמתאמן מספרים או תשובות של כן/לא שיסייעו בניתוח והבנה של ההתקדמות שלו.

חוקי השיחה:
	1.	שאל שאלה אחת בלבד בכל הודעה.
	2.	אל תשאל שאלות כלליות. כל שאלה חייבת להיות מדידה: כן/לא, דירוג 1-5, או בחירה מתוך מספר מצומצם של אפשרויות.
	3.	השאלות תמיד צריכות לקדם אותך לאיסוף מידע על המתאמן והאימונים שלו: מטרותיו, מגבלות, מידת ההנאה, המשקלים שבהם השתמש, זמני האימונים, ועומסים פיזיים.
	4.	המטרה הסופית: לאסוף מידע מספרי וברור שיוכל לשמש למעקב שיטתי אחרי ביצועי המתאמן.
	5.	שמור על שאלות קצרות, ענייניות וממוקדות בתוצאה המספרית.
	6.	אל תבזבז שאלות. כל שאלה צריכה להניב מידע כמותי חדש.

דוגמה לגישה:
	•	שאלות לפני אימון: “בסקאלה מ-1 עד 5, כמה אנרגטי אתה מרגיש כרגע?”
	•	שאלות אחרי אימון: “האם היום הרמת משקל כבד יותר מבפעם הקודמת? (כן/לא)”
	•	המשך שיחה: “כמה סטים של סקוואט עשית היום?” או “כמה חזרות ביצעת בכל סט של סקוואט?”

פעל לפי ההנחיות הללו באופן עקבי לאורך כל השיחה.`;

const conversations = new Map();

async function sendWhatsAppMessage(to, content) {
    try {
        const messageBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'text',
            text: { body: content }
        };

        await whatsappApi.post(
            `/${process.env.PHONE_NUMBER_ID}/messages?access_token=${process.env.WHATSAPP_TOKEN}`,
            messageBody
        );
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error);
        throw error;
    }
}

async function getAIResponse(userId, userMessage) {
    try {
        // Check if user wants to restart conversation
        if (userMessage.trim().toLowerCase() === 'מחדש') {
            conversations.delete(userId);
            conversations.set(userId, []);
            const history = conversations.get(userId);
            
            // Get fresh start response
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: "היי" }
                ],
                temperature: 0.7,
                max_tokens: 200
            });

            const response = completion.choices[0].message.content;
            history.push({ role: "assistant", content: response });
            return response;
        }

        // Regular conversation flow
        if (!conversations.has(userId)) {
            conversations.set(userId, []);
        }
        const history = conversations.get(userId);

        // Add user message to history
        history.push({ role: "user", content: userMessage });

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...history.slice(-5) // Keep last 5 messages for context
            ],
            temperature: 0.7,
            max_tokens: 200
        });

        const response = completion.choices[0].message.content;

        // Add AI response to history
        history.push({ role: "assistant", content: response });

        // Keep history manageable
        if (history.length > 10) {
            history.splice(0, 2);
        }

        return response;
    } catch (error) {
        console.error('Error getting AI response:', error);
        return 'מצטער, נתקלתי בבעיה. אנא נסה שוב.';
    }
}

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Handle incoming messages
app.post('/webhook', async (req, res) => {
    try {
        console.log('Received webhook:', JSON.stringify(req.body, null, 2));

        if (req.body.object === 'whatsapp_business_account') {
            if (req.body.entry && 
                req.body.entry[0].changes && 
                req.body.entry[0].changes[0] && 
                req.body.entry[0].changes[0].value.messages && 
                req.body.entry[0].changes[0].value.messages[0]
            ) {
                const message = req.body.entry[0].changes[0].value.messages[0];
                const metadata = req.body.entry[0].changes[0].value.metadata;
                
                // Validate that this message is for our phone number
                if (metadata && metadata.phone_number_id !== process.env.PHONE_NUMBER_ID) {
                    console.log('Message not for our phone number:', metadata.phone_number_id);
                    return res.sendStatus(200);
                }

                const from = message.from;
                let msgBody;

                // Extract message text
                if (message.type === 'text' && message.text.body) {
                    msgBody = message.text.body;
                } else {
                    console.log('Unsupported message type:', message);
                    return res.sendStatus(200);
                }

                // Get AI response and send it
                const aiResponse = await getAIResponse(from, msgBody);
                await sendWhatsAppMessage(from, aiResponse);
                res.sendStatus(200);
            } else {
                console.log('Invalid webhook structure:', req.body);
                res.sendStatus(404);
            }
        } else {
            console.log('Invalid webhook object:', req.body.object);
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Simple bot server is running on port ${port}`);
}); 