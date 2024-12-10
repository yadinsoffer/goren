# Minimal WhatsApp Bot

A simple WhatsApp bot that handles incoming messages, asks a yes/no question, and logs responses.

## Features

- Webhook endpoint for WhatsApp messages
- Simple yes/no question flow
- Response logging to console and JSON file
- Environment variable configuration
- Basic error handling

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env` file and fill in your values:
     - `WHATSAPP_TOKEN`: Your WhatsApp API token
     - `VERIFY_TOKEN`: Your custom verification token
     - `PHONE_NUMBER_ID`: Your WhatsApp Phone Number ID
     - `PORT`: Server port (default: 3000)

3. Start the server:
   ```bash
   npm start
   ```

## Webhook Setup

1. Make your webhook publicly accessible (e.g., using ngrok)
2. Configure the WhatsApp webhook in Meta Developer Console:
   - Webhook URL: `https://your-domain/webhook`
   - Verify token: Use the same value as your `VERIFY_TOKEN`

## Usage

1. Send any message to your WhatsApp business number
2. Bot will respond with a yes/no question
3. Reply with "yes" or "no"
4. Bot will confirm and log your response

## Response Logging

Responses are logged to:
- Console output
- `src/responses.json` file
