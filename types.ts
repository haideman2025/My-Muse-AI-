
// FIX: Added full type definitions to make this file a valid module and resolve import errors across the app.
export enum Gender {
    Female = 'Female',
    Male = 'Male',
}

export enum ArtStyle {
    Realistic = 'Realistic',
}

export enum Ethnicity {
    Asian = 'Asian',
    Black = 'Black',
    White = 'White',
    Latina = 'Latina',
    Arab = 'Arab',
    Indian = 'Indian',
    Custom = 'Custom',
}

export enum HairStyle {
    Long = 'Long',
    Short = 'Short',
    Ponytail = 'Ponytail',
    Braided = 'Braided',
    Bangs = 'Bangs',
    Bun = 'Bun',
    Buns = 'Buns',
    Wavy = 'Wavy',
    Pixie = 'Pixie',
    Dreadlocks = 'Dreadlocks',
    Afro = 'Afro',
    Mullet = 'Mullet',
    WolfCut = 'Wolf Cut',
    Undercut = 'Undercut',
    Custom = 'Custom',
}

export enum BodyType {
    Slim = 'Slim',
    Athletic = 'Athletic',
    Voluptuous = 'Voluptuous',
    Curvy = 'Curvy',
    Muscular = 'Muscular',
}

export enum BreastSize {
    Flat = 'Flat',
    Small = 'Small',
    Medium = 'Medium',
    Large = 'Large',
    XL = 'XL',
}

export enum ButtSize {
    Small = 'Small',
    Skinny = 'Skinny',
    Athletic = 'Athletic',
    Medium = 'Medium',
    Large = 'Large',
}

export interface GalleryImage {
    id: string;
    url: string;
    createdAt: number;
    prompt: string;
}

export interface Lookbook {
    id: string;
    theme: string;
    prompt: string;
    images: GalleryImage[];
    createdAt: number;
}

export interface WardrobeItem {
    id: string;
    name: string;
    imageUrl: string;
    masterPrompt: string;
}

export interface VideoAsset {
    id: string;
    url: string; // Blob URL
    createdAt: number;
    prompt: string;
    downloadUri?: string;
    videoObject?: any; // Will store the raw video object from the VEO response
    extensionCount?: number; // To track how many times it has been extended
    isProcessing?: boolean;
}

export interface StoryboardScene {
    id: string;
    sceneNumber: number;
    description: string;
    cameraAngle: string;
    setting: string;
    action: string;
    imageUrl?: string;
    isGenerating?: boolean;
    // FIX: Add missing 'outfit' property to resolve type error in geminiService.ts.
    outfit?: string;
}

export interface Storyboard {
    id: string;
    title: string;
    category: string;
    scenes: StoryboardScene[];
    createdAt: number;
    characterId: string;
}

export interface CharacterProfile {
    id: string;
    name: string;
    age: number;
    gender: Gender;
    style: ArtStyle;
    ethnicity: Ethnicity;
    customEthnicity?: string;
    skinTone: string;
    eyeColor: string;
    hairColor: string;
    hairStyle: HairStyle;
    customHairStyle?: string;
    bodyType: BodyType;
    breastSize: BreastSize;
    buttSize: ButtSize;
    personality: string;
    occupation: string;
    relationship: string;
    hobby: string;
    fetish?: string;
    publicDescription?: string;
    customPhysicalDetails?: string;
    greeting?: string;
    scenario?: string;
    storyline?: string;
    additionalPersonality?: string;
    extraDetails?: string;
    tags?: string[];
    referenceImage?: string; // base64 data URL
    singleImages: GalleryImage[];
    lookbooks: Lookbook[];
    wardrobe?: WardrobeItem[];
    videos?: VideoAsset[];
    storyboards?: Storyboard[];
}

export interface GameRound {
    dialogue: string;
    imagePrompt?: string;
    level: number;
    clothing: string;
}

// FIX: Added CategorizedClothing interface for use in the Beer Catch game.
export interface CategorizedClothing {
    accessories: string[];
    outerwear: string[];
    main_clothing: string[];
}

// --- SUBSCRIPTION TYPES ---
export enum SubscriptionTier {
    FREE = 'FREE', // Default, 0 images (or extremely limited if we wanted, but logic says plans start at trial)
    TRIAL = 'TRIAL', // 1$ - 3 days - 10 images/day
    SILVER = 'SILVER', // 5$ - 15 images/day
    GOLD = 'GOLD', // 15$ - 100 images/day
    DIAMOND = 'DIAMOND' // 49.99$ - 500 images/day
}

export interface UserSubscription {
    tier: SubscriptionTier;
    startDate: number; // Timestamp
    expiryDate: number | null; // Null for monthly auto-renew logic simulation, or specific date for trial
    dailyUsage: number;
    lastUsageDate: string; // YYYY-MM-DD to track daily resets
    hasUsedTrial: boolean; // To prevent re-using trial
}
