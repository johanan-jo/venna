/**
 * Game Model for Online Multiplayer Games Platform
 */

export enum GameCategory {
  BOARD_GAME = 'board_game',
  ARCADE = 'arcade',
  STRATEGY = 'strategy',
  PARTY = 'party',
  CARD = 'card',
  WORD = 'word',
  ACTION = 'action',
  PUZZLE = 'puzzle',
  SPORTS = 'sports',
  TRIVIA = 'trivia'
}

export enum PricingModel {
  FREE = 'free',
  FREEMIUM = 'freemium',
  PAID = 'paid',
  SUBSCRIPTION = 'subscription'
}

export interface PlayerRange {
  min: number;
  max: number;
  optimal?: number; // Optimal number of players for best experience
}

export interface Game {
  id: string;
  name: string;
  description: string;
  categories: GameCategory[];
  playerRange: PlayerRange;
  supportsPrivateRooms: boolean;
  pricingModel: PricingModel;
  websiteUrl: string;
  imageUrl?: string;
  
  // Game features
  features: {
    voiceChat?: boolean;
    textChat?: boolean;
    crossPlatform?: boolean;
    mobileSupport?: boolean;
    spectatorMode?: boolean;
    customRules?: boolean;
  };
  
  // Metadata
  averageGameDuration?: number; // in minutes
  difficulty?: 'easy' | 'medium' | 'hard';
  ageRating?: string;
  popularity?: number; // 1-10 scale
  releaseYear?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GameRoom {
  id: string;
  gameId: string;
  hostId: string;
  name: string;
  isPrivate: boolean;
  roomCode?: string;
  maxPlayers: number;
  currentPlayers: string[]; // Array of player IDs
  status: 'waiting' | 'in-progress' | 'finished';
  settings?: Record<string, any>; // Custom game settings
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    favoriteGames: string[]; // Array of game IDs
    totalPlayTime: number; // in minutes
  };
  friends: string[]; // Array of player IDs
  createdAt: Date;
  lastActiveAt: Date;
}

export interface GameSession {
  id: string;
  gameId: string;
  roomId: string;
  players: {
    playerId: string;
    score?: number;
    rank?: number;
    isWinner?: boolean;
  }[];
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in minutes
  replay?: string; // URL to replay if available
}

// Example games data structure
export const exampleGames: Partial<Game>[] = [
  {
    name: 'Animal Stack',
    description: 'Stack animals on top of each other without letting them fall',
    categories: [GameCategory.PARTY, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Archery',
    description: 'Competitive archery shooting game',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 5,
  },
  {
    name: 'Gravity Run',
    description: 'Navigate through obstacles with gravity-defying mechanics',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 8,
  },
  {
    name: 'Sea Battle',
    description: 'Strategic naval warfare game, sink your opponent\'s ships',
    categories: [GameCategory.STRATEGY, GameCategory.BOARD_GAME],
    playerRange: { min: 2, max: 2, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 15,
  },
  {
    name: 'Dart',
    description: 'Classic dart throwing game with precise aim mechanics',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 10,
  },
  {
    name: 'Wrestle',
    description: 'Competitive wrestling game with simple controls',
    categories: [GameCategory.SPORTS, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Ball Games Physics',
    description: 'Physics-based ball games collection',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 7,
  },
  {
    name: 'Broken Tiles',
    description: 'Break tiles strategically to win',
    categories: [GameCategory.PUZZLE, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Ludo',
    description: 'Classic board game - race your pieces to the finish',
    categories: [GameCategory.BOARD_GAME],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 20,
  },
  {
    name: 'Yazi',
    description: 'Dice-rolling strategy game (Yahtzee-style)',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 15,
  },
  {
    name: 'Light Fingers',
    description: 'Fast-paced reflex and reaction game',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Pool',
    description: 'Classic 8-ball or 9-ball pool game',
    categories: [GameCategory.SPORTS],
    playerRange: { min: 2, max: 2, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 15,
  },
  {
    name: 'Happy Hippos',
    description: 'Fun hippo-themed party game',
    categories: [GameCategory.PARTY, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 8,
  },
  {
    name: 'Racing Cars',
    description: 'Fast-paced racing game with multiple tracks',
    categories: [GameCategory.ARCADE, GameCategory.ACTION, GameCategory.SPORTS],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Spin War',
    description: 'Spinning battle arena game',
    categories: [GameCategory.PARTY, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Happy Birds',
    description: 'Bird-themed arcade game with flying mechanics',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 7,
  },
  {
    name: 'Pull The Rope',
    description: 'Tug of war style game, pull your opponent off balance',
    categories: [GameCategory.PARTY, GameCategory.SPORTS],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 3,
  },
  {
    name: 'Tic Tac Toe',
    description: 'Classic X and O strategy game',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 2, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 3,
  },
  {
    name: 'Traffic Jam',
    description: 'Puzzle game to navigate vehicles through traffic',
    categories: [GameCategory.PUZZLE, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Archery Master',
    description: 'Advanced archery game with challenging targets',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'hard',
    averageGameDuration: 8,
  },
  {
    name: 'Dots and Boxes',
    description: 'Classic pen and paper strategy game',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 10,
  },
  {
    name: 'Hot Potato',
    description: 'Pass the hot potato before it explodes',
    categories: [GameCategory.PARTY],
    playerRange: { min: 3, max: 8, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Rat Race',
    description: 'Racing game with rats competing to reach the finish',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 7,
  },
  {
    name: 'Fruit Dual',
    description: 'Competitive fruit slicing and matching game',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 2, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Memory',
    description: 'Classic card matching memory game',
    categories: [GameCategory.PUZZLE, GameCategory.CARD],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 10,
  },
  {
    name: 'Snakes',
    description: 'Classic snake and ladder board game',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 15,
  },
  {
    name: 'Golf',
    description: 'Mini golf or full golf simulation',
    categories: [GameCategory.SPORTS],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 15,
  },
  {
    name: 'Whack A Mole',
    description: 'Classic arcade game - whack the moles as they pop up',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Star Catcher',
    description: 'Collect falling stars before your opponents',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 7,
  },
  {
    name: 'Paint Fight',
    description: 'Colorful paint battle arena',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 8,
  },
  {
    name: 'Math Quiz',
    description: 'Competitive math trivia and problem solving',
    categories: [GameCategory.TRIVIA, GameCategory.PUZZLE],
    playerRange: { min: 2, max: 6, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Knife Hit',
    description: 'Throw knives to hit the target without hitting other knives',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 7,
  },
  {
    name: 'Frogs Fight',
    description: 'Battle arena with fighting frogs',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 6,
  },
  {
    name: 'Explosive Festival',
    description: 'Chaotic party game with explosions',
    categories: [GameCategory.PARTY, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Piranha Rush',
    description: 'Survive the piranha-infested waters',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 8,
  },
  {
    name: 'Chess',
    description: 'Classic strategic chess game',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 2, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true, spectatorMode: true },
    difficulty: 'hard',
    averageGameDuration: 30,
  },
  {
    name: 'Money Grabber',
    description: 'Collect as much money as possible before time runs out',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Hammer Hit',
    description: 'Hit the targets with your hammer for points',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 6,
  },
  {
    name: 'Cornhole',
    description: 'Classic bean bag tossing game',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 10,
  },
  {
    name: 'Unfair Fishing',
    description: 'Competitive fishing game with twists and surprises',
    categories: [GameCategory.ARCADE, GameCategory.PARTY],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 8,
  },
  {
    name: 'King of the Yard',
    description: 'Battle to control the yard and push opponents out',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 7,
  },
  {
    name: 'The Last Sashimi',
    description: 'Compete to grab the last piece of sushi',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 5,
  },
  {
    name: 'Soccer Pool',
    description: 'Hybrid game combining soccer and pool mechanics',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 10,
  },
  {
    name: 'Chicken Jump',
    description: 'Help chickens jump over obstacles',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 6,
  },
  {
    name: 'Flappy Jump',
    description: 'Flappy Bird style jumping game with multiplayer',
    categories: [GameCategory.ARCADE, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 5,
  },
  {
    name: 'Beach Ball',
    description: 'Keep the beach ball in the air longer than opponents',
    categories: [GameCategory.PARTY, GameCategory.SPORTS],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 7,
  },
  {
    name: 'Spike Attack',
    description: 'Dodge and attack with spikes in a battle arena',
    categories: [GameCategory.ACTION, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 6,
  },
  {
    name: 'Color Wars',
    description: 'Paint the arena with your color to dominate',
    categories: [GameCategory.PARTY, GameCategory.ACTION],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 8,
  },
  {
    name: 'Dice Combat',
    description: 'Strategic combat game using dice rolls',
    categories: [GameCategory.BOARD_GAME, GameCategory.STRATEGY],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 12,
  },
  {
    name: 'Snake and Ladders',
    description: 'Classic board game - climb ladders and avoid snakes',
    categories: [GameCategory.BOARD_GAME],
    playerRange: { min: 2, max: 4, optimal: 3 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 15,
  },
  {
    name: 'Target Practice',
    description: 'Shooting game to hit various targets for high scores',
    categories: [GameCategory.SPORTS, GameCategory.ARCADE],
    playerRange: { min: 2, max: 4, optimal: 2 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'medium',
    averageGameDuration: 8,
  },
  {
    name: 'Slot Cars',
    description: 'Race miniature slot cars around a track',
    categories: [GameCategory.ARCADE, GameCategory.SPORTS],
    playerRange: { min: 2, max: 4, optimal: 4 },
    supportsPrivateRooms: true,
    pricingModel: PricingModel.FREE,
    websiteUrl: '',
    features: { textChat: true, crossPlatform: true, mobileSupport: true },
    difficulty: 'easy',
    averageGameDuration: 10,
  },
];
