
export const mockItems = [
  {
    id: 1,
    code: 'DIAMOND_SWORD',
    name: '다이아몬드 검',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/1/1e/Diamond_Sword_JE3_BE3.png',
    currentValue: 150,
    status: 'approved',
    votes: 8,
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    code: 'NETHERITE_PICKAXE',
    name: '네더라이트 곡괭이',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/2/27/Netherite_Pickaxe_JE2_BE2.png',
    currentValue: 500,
    status: 'approved',
    votes: 12,
    createdAt: '2024-01-14T15:20:00Z'
  },
  {
    id: 3,
    code: 'ENCHANTED_GOLDEN_APPLE',
    name: '마법이 부여된 황금 사과',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/a/a3/Enchanted_Golden_Apple_JE2_BE2.gif',
    currentValue: 300,
    status: 'approved',
    votes: 15,
    createdAt: '2024-01-13T09:45:00Z'
  },
  {
    id: 4,
    code: 'ELYTRA',
    name: '겉날개',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/5/5d/Elytra_JE2_BE2.png',
    currentValue: 800,
    status: 'approved',
    votes: 20,
    createdAt: '2024-01-12T14:10:00Z'
  },
  {
    id: 5,
    code: 'TOTEM_OF_UNDYING',
    name: '불사의 토템',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/2/2b/Totem_of_Undying_JE2_BE2.png',
    currentValue: 250,
    status: 'pending',
    votes: 3,
    createdAt: '2024-01-16T11:00:00Z'
  },
  {
    id: 6,
    code: 'SHULKER_BOX',
    name: '셜커 상자',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/4/4a/Shulker_Box_JE2_BE2.png',
    currentValue: 180,
    status: 'pending',
    votes: 2,
    createdAt: '2024-01-16T13:30:00Z'
  }
];

export const mockProposals = [
  {
    id: 1,
    itemId: 5,
    itemCode: 'TOTEM_OF_UNDYING',
    itemName: '불사의 토템',
    itemImage: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/2/2b/Totem_of_Undying_JE2_BE2.png',
    proposedValue: 250,
    currentVotes: 3,
    requiredVotes: 5,
    status: 'voting',
    submittedBy: 'user123',
    submittedAt: '2024-01-16T11:00:00Z'
  },
  {
    id: 2,
    itemId: 6,
    itemCode: 'SHULKER_BOX',
    itemName: '셜커 상자',
    itemImage: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/4/4a/Shulker_Box_JE2_BE2.png',
    proposedValue: 180,
    currentVotes: 2,
    requiredVotes: 5,
    status: 'voting',
    submittedBy: 'user456',
    submittedAt: '2024-01-16T13:30:00Z'
  },
  {
    id: 3,
    itemId: 7,
    itemCode: 'BEACON',
    itemName: '신호기',
    itemImage: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/0/0f/Beacon_JE6_BE2.png',
    proposedValue: 1000,
    currentVotes: 1,
    requiredVotes: 5,
    status: 'voting',
    submittedBy: 'user789',
    submittedAt: '2024-01-16T16:45:00Z'
  }
];

export const mockAdminItems = [
  {
    id: 1,
    code: 'DIAMOND_SWORD',
    name: '다이아몬드 검',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/1/1e/Diamond_Sword_JE3_BE3.png',
    currentValue: 150,
    status: 'approved',
    votes: 8,
    createdAt: '2024-01-15T10:30:00Z',
    lastModified: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    code: 'NETHERITE_PICKAXE',
    name: '네더라이트 곡괭이',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/2/27/Netherite_Pickaxe_JE2_BE2.png',
    currentValue: 500,
    status: 'approved',
    votes: 12,
    createdAt: '2024-01-14T15:20:00Z',
    lastModified: '2024-01-14T15:20:00Z'
  },
  {
    id: 3,
    code: 'ENCHANTED_GOLDEN_APPLE',
    name: '마법이 부여된 황금 사과',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/a/a3/Enchanted_Golden_Apple_JE2_BE2.gif',
    currentValue: 300,
    status: 'approved',
    votes: 15,
    createdAt: '2024-01-13T09:45:00Z',
    lastModified: '2024-01-13T09:45:00Z'
  },
  {
    id: 4,
    code: 'ELYTRA',
    name: '겉날개',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/5/5d/Elytra_JE2_BE2.png',
    currentValue: 800,
    status: 'approved',
    votes: 20,
    createdAt: '2024-01-12T14:10:00Z',
    lastModified: '2024-01-12T14:10:00Z'
  },
  {
    id: 5,
    code: 'TOTEM_OF_UNDYING',
    name: '불사의 토템',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/2/2b/Totem_of_Undying_JE2_BE2.png',
    proposedValue: 250,
    currentValue: 0,
    status: 'pending',
    votes: 3,
    createdAt: '2024-01-16T11:00:00Z',
    lastModified: '2024-01-16T11:00:00Z'
  },
  {
    id: 6,
    code: 'SHULKER_BOX',
    name: '셜커 상자',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/4/4a/Shulker_Box_JE2_BE2.png',
    proposedValue: 180,
    currentValue: 0,
    status: 'pending',
    votes: 2,
    createdAt: '2024-01-16T13:30:00Z',
    lastModified: '2024-01-16T13:30:00Z'
  },
  {
    id: 7,
    code: 'BEACON',
    name: '신호기',
    image: 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/0/0f/Beacon_JE6_BE2.png',
    proposedValue: 1000,
    currentValue: 0,
    status: 'pending',
    votes: 1,
    createdAt: '2024-01-16T16:45:00Z',
    lastModified: '2024-01-16T16:45:00Z'
  }
];
