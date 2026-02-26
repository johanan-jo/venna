# Online Multiplayer Games Platform Model

This project contains a data model for managing online multiplayer games that can be played with friends.

## Model Structure

### Core Entities

1. **Game** - Represents an individual game
   - Basic info (name, description, categories)
   - Player range (min, max, optimal)
   - Features (private rooms, pricing, chat support, etc.)
   - Metadata (duration, difficulty, popularity)

2. **GameRoom** - Represents a game lobby/room
   - Associated with a specific game
   - Tracks players and room status
   - Supports private rooms with codes

3. **Player** - Represents a user/player
   - Profile information
   - Stats (games played, wins, playtime)
   - Friends list

4. **GameSession** - Represents a completed or ongoing game instance
   - Links to game, room, and players
   - Tracks scores, winners, and duration

## Usage

Add your games to the model by filling in the game details:

```typescript
const myGame: Game = {
  id: 'game-001',
  name: 'Chess Online',
  description: 'Classic chess game with friends',
  categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
  playerRange: { min: 2, max: 2, optimal: 2 },
  supportsPrivateRooms: true,
  pricingModel: PricingModel.FREE,
  websiteUrl: 'https://chess.com',
  features: {
    textChat: true,
    crossPlatform: true,
    mobileSupport: true,
  },
  difficulty: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## Game Categories

- Board Game
- Arcade
- Strategy
- Party
- Card
- Word
- Action
- Puzzle
- Sports
- Trivia

## Pricing Models

- **Free** - Completely free to play
- **Freemium** - Free with premium features
- **Paid** - One-time purchase
- **Subscription** - Recurring payment

## Next Steps

1. Add your games to the `exampleGames` array in `game-model.ts`
2. Implement database integration (MongoDB, PostgreSQL, etc.)
3. Create API endpoints for CRUD operations
4. Build frontend UI to browse and filter games
