require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize conversation history
const userConversations = new Map();

// System prompt for the AI trainer
const TRAINER_SYSTEM_PROMPT = `You are a coach following up after a structured WOD (Workout of the Day) at the gym. Your goal is to collect specific data about how the member performed in today's programmed workout through a brief, natural conversation in Hebrew.

CONVERSATION OBJECTIVE:
- Have a quick post-WOD chat (30-240 seconds)
- Collect specific data about their performance in today's workout parts
- Focus questions on the specific components from today's WOD
- Keep it brief and natural

KEY DATA TO COLLECT:
1. Which part of the WOD was most challenging
2. Specific weights used in strength/power portions
3. Time/rounds completed in metcon portions
4. Scale or RX for movements
5. Any movement difficulties

CONVERSATION RULES:
- Respond in Hebrew
- One question per message
- Keep responses brief and natural
- Ask about specific movements/weights from today's WOD
- Don't ask general questions - stick to today's programming

EXAMPLE FLOW:
User: "סיימתי אימון"
Bot: "איזה חלק היה הכי מאתגר היום - החלק של הכוח או המטקון?"
User: "המטקון"
Bot: "כמה סבבים הספקת במטקון?"
(continue focused on specific parts of today's WOD)

Remember: You're collecting specific data about their performance in today's programmed workout. Keep questions relevant to the day's specific movements and portions.`;

// Track workout data
const workoutData = new Map();

// Helper function to extract and store workout data
function updateWorkoutData(from, message) {
  if (!workoutData.has(from)) {
    workoutData.set(from, {
      workouts: [],
      goals: {},
      lastWorkout: null,
      exerciseHistory: new Map(), // Track history per exercise
      lastWeightIncrease: new Map() // Track last weight increase per exercise
    });
  }

  const userData = workoutData.get(from);
  
  // Try to extract workout data from the message
  const exerciseMatch = message.match(/(\w+)(?:\s+|:)(\d+)\s*(?:ק"ג|קילו|kg).*?(\d+)\s*(?:חזרות|פעמים|reps)/i);
  const difficultyMatch = message.match(/דירוג.*?(\d)/i);
  const painMatch = message.match(/כאב.*?(כן|לא)/i);
  const exerciseNameMatch = message.match(/(?:תרגיל|עשיתי|ביצעתי)\s+(\w+)/i);
  
  if (exerciseMatch) {
    const [_, exerciseName, weight, reps] = exerciseMatch;
    if (!userData.lastWorkout) {
      userData.lastWorkout = {
        date: new Date(),
        exercises: []
      };
      userData.workouts.push(userData.lastWorkout);
    }

    // Track exercise history
    if (!userData.exerciseHistory.has(exerciseName)) {
      userData.exerciseHistory.set(exerciseName, []);
    }
    const history = userData.exerciseHistory.get(exerciseName);
    const weightNum = parseInt(weight);
    const repsNum = parseInt(reps);
    
    history.push({
      date: new Date(),
      weight: weightNum,
      reps: repsNum
    });

    // Keep history manageable
    if (history.length > 30) {
      history.shift();
    }

    userData.lastWorkout.exercises.push({
      name: exerciseName,
      weight: weightNum,
      reps: repsNum,
      timestamp: new Date()
    });
  }

  if (difficultyMatch) {
    if (!userData.lastWorkout) {
      userData.lastWorkout = {
        date: new Date(),
        exercises: []
      };
      userData.workouts.push(userData.lastWorkout);
    }
    userData.lastWorkout.difficulty = parseInt(difficultyMatch[1]);
  }

  if (painMatch) {
    if (!userData.lastWorkout) {
      userData.lastWorkout = {
        date: new Date(),
        exercises: []
      };
      userData.workouts.push(userData.lastWorkout);
    }
    userData.lastWorkout.pain = painMatch[1] === 'כן';
  }

  // Keep only last 30 workouts
  if (userData.workouts.length > 30) {
    userData.workouts.shift();
  }

  workoutData.set(from, userData);
  return userData;
}

// Helper function to analyze workout trends
function analyzeWorkoutTrends(from) {
  const userData = workoutData.get(from);
  if (!userData || userData.workouts.length < 2) return null;

  const trends = {
    difficultyTrend: 0,
    weightProgress: {},
    exerciseAnalysis: {},
    weightIncreaseOpportunities: [],
    recommendations: []
  };

  // Analyze each exercise's progression
  userData.exerciseHistory.forEach((history, exerciseName) => {
    if (history.length < 2) return;

    const analysis = {
      weightTrend: 0,
      repTrend: 0,
      lastIncrease: null,
      consistentWeight: 0,
      readyForIncrease: false
    };

    // Calculate trends
    const recentSessions = history.slice(-5);
    const currentWeight = recentSessions[recentSessions.length - 1].weight;
    const consistentWeightCount = recentSessions.filter(s => s.weight === currentWeight).length;
    
    // Check if weight has been consistent for last 3+ sessions
    if (consistentWeightCount >= 3) {
      analysis.consistentWeight = consistentWeightCount;
      
      // Check if reps are stable or increasing
      const recentReps = recentSessions.slice(-3).map(s => s.reps);
      const avgReps = recentReps.reduce((a, b) => a + b, 0) / recentReps.length;
      
      if (avgReps >= 8 && consistentWeightCount >= 3) {
        analysis.readyForIncrease = true;
        trends.weightIncreaseOpportunities.push({
          exercise: exerciseName,
          currentWeight,
          suggestedIncrease: Math.min(5, Math.ceil(currentWeight * 0.05)) // 5% or 5kg max
        });
      }
    }

    // Find last weight increase
    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i].weight < history[i + 1].weight) {
        analysis.lastIncrease = history[i + 1].date;
        break;
      }
    }

    trends.exerciseAnalysis[exerciseName] = analysis;
  });

  // Generate recommendations
  trends.weightIncreaseOpportunities.forEach(opp => {
    trends.recommendations.push(
      `נראה שאתה מוכן להעלות משקל ב${opp.exercise}. אתה מרים ${opp.currentWeight} ק"ג בעקביות, אפשר לנסות להעלות ל-${opp.currentWeight + opp.suggestedIncrease} ק"ג.`
    );
  });

  // Analyze difficulty trend
  const recentDifficulties = userData.workouts
    .slice(-5)
    .map(w => w.difficulty)
    .filter(d => d);
  
  if (recentDifficulties.length >= 2) {
    const avgRecent = recentDifficulties.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const avgPrevious = recentDifficulties.slice(0, -2).reduce((a, b) => a + b, 0) / (recentDifficulties.length - 2);
    trends.difficultyTrend = avgRecent - avgPrevious;
  }

  // Analyze weight progress
  userData.workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      if (!trends.weightProgress[exercise.weight]) {
        trends.weightProgress[exercise.weight] = [];
      }
      trends.weightProgress[exercise.weight].push(exercise.reps);
    });
  });

  const recentPains = userData.workouts.slice(-3).filter(w => w.pain).length;
  if (recentPains >= 2) {
    trends.recommendations.push('שים לב שדיווחת על כאבים לאחרונה. כדאי לבדוק את הטכניקה ואולי להוריד קצת בעומסים.');
  }

  return trends;
}

// Send WhatsApp message
async function sendWhatsAppMessage(to, content) {
  try {
    let messageBody;
    
    if (typeof content === 'string') {
      messageBody = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: content }
      };
    } else if (content.type === 'button' || content.type === 'list') {
      messageBody = {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: content
      };
    }

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      messageBody,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('WhatsApp token expired or invalid:', error.response.data);
      // You could implement token refresh logic here
      throw new Error('WhatsApp authentication failed - token may have expired');
    }
    console.error('Error sending message:', error.response?.data || error);
    throw error;
  }
}

// Add token validation check on startup
async function validateWhatsAppToken() {
  try {
    await axios.get(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
        }
      }
    );
    console.log('WhatsApp token validated successfully');
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('WhatsApp token is invalid or has expired. Please update the token.');
      process.exit(1);
    }
    throw error;
  }
}

// Initialize server with token validation
async function initializeServer() {
  try {
    await validateWhatsAppToken();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initializeServer();

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

async function getAIResponse(from, userMessage) {
  try {
    // Update workout data
    const userData = updateWorkoutData(from, userMessage);
    
    // Analyze trends if we have enough data
    const trends = analyzeWorkoutTrends(from);
    
    // Get or initialize conversation history
    if (!userConversations.has(from)) {
      userConversations.set(from, []);
    }
    const conversationHistory = userConversations.get(from);
    
    // Add user message to history
    conversationHistory.push({ role: "user", content: userMessage });
    
    // Add workout context to system message
    let systemMessage = TRAINER_SYSTEM_PROMPT;
    if (trends) {
      systemMessage += `\n\nCurrent user context:
- Difficulty trend: ${trends.difficultyTrend > 0 ? 'עולה' : trends.difficultyTrend < 0 ? 'יורד' : 'יציב'}
- Recent pains: ${userData.workouts.slice(-3).filter(w => w.pain).length} out of last 3 workouts
- Recommendations: ${trends.recommendations.join(' ')}`;
    }
    
    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemMessage },
        ...conversationHistory
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Add AI response to history
    conversationHistory.push({ role: "assistant", content: aiResponse });
    
    // Keep conversation history manageable
    if (conversationHistory.length > 10) {
      conversationHistory.splice(0, 2);
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error getting AI response:', error);
    return 'סליחה, נתקלתי בבעיה. אנא נסה שוב.';
  }
}

// Webhook for handling incoming messages
app.post('/webhook', async (req, res) => {
  try {
    const { entry } = req.body;
    
    if (!entry || !Array.isArray(entry)) {
      return res.sendStatus(400);
    }

    for (const messageEntry of entry) {
      for (const change of messageEntry.changes) {
        if (change.value?.messages) {
          for (const message of change.value.messages) {
            const from = message.from;
            const messageText = message.text?.body;
            const buttonResponse = message.interactive?.button_reply;
            const listResponse = message.interactive?.list_reply;
            
            let userInput = messageText || 
                           (buttonResponse && buttonResponse.title) || 
                           (listResponse && listResponse.title) || '';

            if (userInput) {
              const aiResponse = await getAIResponse(from, userInput);
              
              // Check if response should be interactive
              if (aiResponse.includes('[button]') || aiResponse.includes('[list]')) {
                // Handle interactive responses
                const interactiveMessage = createInteractiveMessage(aiResponse);
                await sendWhatsAppMessage(from, interactiveMessage);
              } else {
                await sendWhatsAppMessage(from, aiResponse);
              }
            }
          }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
});

// Helper function to create interactive messages
function createInteractiveMessage(aiResponse) {
  if (aiResponse.includes('[button]')) {
    // Extract button data from response
    const match = aiResponse.match(/\[button\]\s*([^[]+)\s*\[(.*)\]/);
    if (match) {
      const question = match[1].trim();
      const buttons = match[2].split(',').map(btn => {
        const [id, title] = btn.trim().split(':');
        return { id, title };
      });

      return {
        type: 'button',
        question,
        buttons
      };
    }
  }

  if (aiResponse.includes('[list]')) {
    // Extract list data from response
    const match = aiResponse.match(/\[list\]\s*([^[]+)\s*\[(.*)\]/);
    if (match) {
      const question = match[1].trim();
      const options = match[2].split(',').map(opt => {
        const [id, title, description] = opt.trim().split(':');
        return { id, title, description: description || '' };
      });

      return {
        type: 'list',
        question,
        options
      };
    }
  }

  // Default to text message if no interactive elements found
  return {
    type: 'text',
    text: { body: aiResponse.replace(/\[button\].*\[.*\]|\[list\].*\[.*\]/g, '').trim() }
  };
}
