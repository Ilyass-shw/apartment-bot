# Apartment Hunting Bot

A TypeScript-based bot that monitors Deutsche Wohnen's apartment listings and automatically applies for new apartments.

## Features

- Monitors apartment listings every 2 minutes during weekdays (8 AM - 6 PM)
- Sends Telegram notifications for new listings
- Automatically applies for new apartments
- Stores seen listings in SQLite database
- Runs on free cloud services

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in your details:

   - Get a Telegram bot token from [@BotFather](https://t.me/botfather)
   - Get your Telegram chat ID by messaging your bot and visiting `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Fill in your application details

4. Build the project:
   ```bash
   npm run build
   ```

## Running Locally

```bash
npm start
```

## Deployment

### Option 1: Railway (Recommended)

1. Create a free account on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add your environment variables
4. Deploy!

### Option 2: Render

1. Create a free account on [Render](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Add your environment variables
5. Set the build command: `npm run build`
6. Set the start command: `node dist/app.js`
7. Deploy!

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID
- `APPLICANT_NAME`: Your last name
- `APPLICANT_FIRST_NAME`: Your first name
- `APPLICANT_PHONE`: Your phone number
- `APPLICANT_EMAIL`: Your email address
- `APPLICATION_TEXT`: Your application text

## License

MIT
