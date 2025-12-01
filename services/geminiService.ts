


import { GoogleGenAI, Modality, Type, Operation } from '@google/genai';
import { CharacterProfile, Gender, ArtStyle, Ethnicity, HairStyle, BodyType, GameRound, CategorizedClothing, VideoAsset, StoryboardScene } from '../types';
import { HAIR_COLORS, EYE_COLORS, PERSONALITY_OPTIONS, OCCUPATION_OPTIONS, RELATIONSHIP_OPTIONS, HOBBY_OPTIONS } from '../constants';


const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

// CRITICAL FIX: Increased compression (0.6 quality, 800px width) to significantly reduce Base64 string size
// This prevents LocalStorage from filling up too quickly.
const compressImageBase64 = (base64String: string, quality: number = 0.6, maxWidth: number = 800): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${base64String}`;
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn("Could not get canvas context for compression, returning original.");
                return resolve(base64String);
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            // Force image/jpeg for better compression ratio than png
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl.split(',')[1]);
        };
        img.onerror = error => {
            console.warn("Image compression failed, returning original image.", error);
            resolve(base64String);
        };
    });
};


const buildCharacterPrompt = (character: Partial<CharacterProfile>): string => {
    // This is the base for any image generation, ensuring a consistent, high-quality photographic style.
    const basePrompt = `RAW photo, professional photograph, cinematic lighting, hyper-realistic, extremely detailed, lifelike, 8k, sharp focus, masterpiece. Avoid 3d render, anime, cartoon, illustration, and any artificial look.`;

    // **CRITICAL CHANGE**: The `publicDescription` now acts as the "Visual DNA" or "Master Prompt".
    // It contains the core, unchangeable facial and physical features analyzed from the reference image.
    // We prioritize this to ensure maximum consistency.
    if (character.publicDescription) {
        // We combine the base style prompt with the character's unique "DNA".
        // Additional custom details can be appended for specific scenarios.
        return `${basePrompt} A photograph of (${character.publicDescription}), ${character.customPhysicalDetails || ''}`;
    }

    // **FALLBACK**: If no master prompt exists (e.g., for characters created before this update or without a reference image),
    // we build the prompt from individual attributes. This is less consistent.
    let description = `The subject is a ${character.age}-year-old ${character.gender === Gender.Male ? 'man' : 'woman'}.`;
    
    if (character.ethnicity === Ethnicity.Custom && character.customEthnicity) {
        description += ` Their ethnicity is ${character.customEthnicity}.`;
    } else if (character.ethnicity) {
        description += ` They have ${character.ethnicity} features.`;
    }

    if (character.skinTone) description += ` Skin tone is ${character.skinTone}.`;
    if (character.eyeColor) description += ` Eye color is ${character.eyeColor}.`;
    if (character.hairColor) description += ` Hair color is ${character.hairColor}.`;

    if (character.hairStyle === HairStyle.Custom && character.customHairStyle) {
        description += ` Their hair is styled as: ${character.customHairStyle}.`;
    } else if (character.hairStyle) {
        description += ` They have ${character.hairStyle} hair.`;
    }
    
    if (character.bodyType) description += ` Body type is ${character.bodyType}.`;
    if (character.breastSize) description += ` Breast size is ${character.breastSize}.`;
    if (character.buttSize) description += ` Butt size is ${character.buttSize}.`;
    
    if (character.customPhysicalDetails) description += ` ${character.customPhysicalDetails}.`;

    return `${basePrompt} ${description}`;
};

export const generateStoryline = async (character: CharacterProfile): Promise<string> => {
    const ai = getAI();
    const prompt = `Create a short, intriguing, one-paragraph backstory (around 100 words) for the following character. The tone should be slightly mysterious and romantic. The story must be in Vietnamese.\n\nCharacter Details:\nName: ${character.name}\nAge: ${character.age}\nGender: ${character.gender}\nPersonality: ${character.personality}\nOccupation: ${character.occupation}\nHobby: ${character.hobby}\nRelationship Status: ${character.relationship}\n\nBackstory:`;
    
    // UPGRADE: Use gemini-3-pro-preview for complex creative writing
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            temperature: 0.8,
            topP: 0.95,
        }
    });
    return response.text?.trim() || "";
};

interface GenerateImageOptions {
    numberOfImages?: number;
    makeupPrompt?: string; 
    outfitPrompt?: string;
    backgroundPrompt?: string;
    posePrompt?: string;
    cameraAnglePrompt?: string;
}

const DYNAMIC_CAMERA_ANGLES = [
    'full body shot, cinematic wide angle',
    'dynamic low-angle shot, full body',
    'eye-level medium shot, blurred background',
    'dutch angle full body shot, rule of thirds composition',
    'high-angle establishing shot',
    'candid action shot, motion blur',
    'over-the-shoulder shot, focusing on the character',
    'cinematic portrait, shallow depth of field',
];

function getRandomElements<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export const generateCharacterImage = async (character: CharacterProfile, options: GenerateImageOptions = {}): Promise<string[]> => {
    const ai = getAI();
    const {
        numberOfImages = 1,
        makeupPrompt,
        outfitPrompt,
        backgroundPrompt,
        posePrompt,
        cameraAnglePrompt,
    } = options;

    const baseCharacterPrompt = buildCharacterPrompt(character);
    
    // Helper to construct the full prompt
    const constructPrompt = (angle: string) => {
        let finalPrompt = `${angle}, ${baseCharacterPrompt}`;
        if (makeupPrompt) finalPrompt += `, ${makeupPrompt}`;
        if (outfitPrompt) finalPrompt += `, wearing ${outfitPrompt}`;
        if (backgroundPrompt) finalPrompt += `, in the background is ${backgroundPrompt}`;
        if (posePrompt) finalPrompt += `, posed like this: ${posePrompt}`;
        return finalPrompt;
    };

    // UPGRADE: Use gemini-2.5-flash-image ("Google Banana")
    // This fixes the 403 Permission Denied error often seen with Pro Image models on standard keys,
    // while still delivering high-quality results rapidly.
    
    let requests = [];

    if (numberOfImages === 1) {
         const prompt = constructPrompt(cameraAnglePrompt || 'full body shot, cinematic lighting');
         requests.push(prompt);
    } else {
        const selectedAngles = getRandomElements(DYNAMIC_CAMERA_ANGLES, numberOfImages);
        selectedAngles.forEach(angle => {
             requests.push(constructPrompt(angle));
        });
    }

    // Execute requests in parallel
    const imagePromises = requests.map(async (prompt) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "3:4",
                    // imageSize not supported on Flash Image, handled by AR
                }
            }
        });

        // Extract image from parts
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        return null;
    });

    const rawImages = await Promise.all(imagePromises);
    const validImages = rawImages.filter(img => img !== null) as string[];
    
    const compressedImages = await Promise.all(
        validImages.map(b64 => compressImageBase64(b64))
    );
    return compressedImages;
};


export const generateAndDetailCharacterImage = async (base64Data: string, mimeType: string): Promise<Partial<CharacterProfile>> => {
    const ai = getAI();
    // Use higher resolution (1024) for cloning to capture more facial details
    const compressedBase64 = await compressImageBase64(base64Data, 0.8, 1024);
    
    const personalityList = PERSONALITY_OPTIONS.map(o => o.value).join(', ');
    const occupationList = OCCUPATION_OPTIONS.map(o => o.value).join(', ');
    const relationshipList = RELATIONSHIP_OPTIONS.map(o => o.value).join(', ');
    const hobbyList = HOBBY_OPTIONS.map(o => o.value).join(', ');

    const prompt = `
You are an expert Digital Twin creator and photorealistic character analyst. Your task is to CLONE the person in this image to create a perfect digital replica. Analyze their "Visual DNA" to ensure future generations look exactly like them.

**Part 1: The "Visual DNA" (Master Prompt)**
Generate a dense, ultra-specific paragraph in English. Focus on IMMUTABLE facial and physical characteristics.
- **Face Structure**: Exact face shape, jawline definition (e.g., square, soft, chiseled), cheekbone height/prominence.
- **Eyes**: Precise shape (e.g., almond, round, hooded), eye distance, exact iris color, eyebrow shape and thickness.
- **Nose & Mouth**: Bridge width, tip shape, lip fullness, cupid's bow definition.
- **Distinctive Features**: Moles, freckles, dimples, scars, unique hairline.
- **Body**: Build, proportions, height impression.
- **Example**: "A photorealistic 25-year-old woman with a heart-shaped face, high sharp cheekbones, and a pointed chin. She has wide-set, deep chestnut almond eyes with heavy eyelids and arched, bushy eyebrows. Her nose has a slender bridge and a slightly upturned tip. She has full, pillow-like lips with a soft cupid's bow. A small beauty mark is visible above her right lip..."

**Part 2: Categorical Data**
Based on your analysis, fill in the following fields with the most appropriate values from the provided lists.
*   \`gender\`: 'Female' or 'Male'.
*   \`ethnicity\`: 'Asian', 'Black', 'White', 'Latina', 'Arab', 'Indian'.
*   \`age\`: An estimated integer.
*   \`hairStyle\`: 'Long', 'Short', 'Ponytail', 'Braided', 'Bangs', 'Bun', 'Buns', 'Wavy', 'Pixie', 'Dreadlocks', 'Afro', 'Mullet', 'Wolf Cut', 'Undercut'.
*   \`bodyType\`: 'Slim', 'Athletic', 'Voluptuous', 'Curvy', 'Muscular'.
*   \`hairColor\`: The best matching HEX CODE from: ${HAIR_COLORS.join(', ')}.
*   \`eyeColor\`: The best matching HEX CODE from: ${EYE_COLORS.join(', ')}.

**Part 3: Personality Profile (in Vietnamese)**
Based on their expression and overall vibe, generate a plausible Vietnamese name and select ONE option for each of the following categories from the lists provided.
*   \`name\`: A plausible Vietnamese name.
*   \`personality\`: Choose one from: ${personalityList}.
*   \`occupation\`: Choose one from: ${occupationList}.
*   \`relationship\`: Choose one from: ${relationshipList}.
*   \`hobby\`: Choose one from: ${hobbyList}.

**Output Format:**
Return a single, valid JSON object with ALL the following keys: "publicDescription", "gender", "ethnicity", "age", "hairStyle", "bodyType", "hairColor", "eyeColor", "name", "personality", "occupation", "relationship", "hobby".
    `;
    
    const imagePart = { inlineData: { data: compressedBase64, mimeType: 'image/jpeg' } };
    const textPart = { text: prompt };

    // UPGRADE: Use gemini-3-pro-preview for superior multimodal analysis
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [textPart, imagePart] },
        config: {
            responseMimeType: "application/json",
        }
    });
    
    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
    const analysis = JSON.parse(jsonText);

    return {
        publicDescription: analysis.publicDescription,
        gender: Gender[analysis.gender as keyof typeof Gender] || Gender.Female,
        ethnicity: Ethnicity[analysis.ethnicity as keyof typeof Ethnicity] || Ethnicity.White,
        age: parseInt(analysis.age, 10) || 25,
        hairStyle: HairStyle[analysis.hairStyle as keyof typeof HairStyle] || HairStyle.Long,
        bodyType: BodyType[analysis.bodyType as keyof typeof BodyType] || BodyType.Athletic,
        hairColor: analysis.hairColor || HAIR_COLORS[0],
        eyeColor: analysis.eyeColor || EYE_COLORS[0],
        name: analysis.name,
        personality: analysis.personality,
        occupation: analysis.occupation,
        relationship: analysis.relationship,
        hobby: analysis.hobby,
    };
};

export const generateSceneConcept = async (character: CharacterProfile): Promise<{makeup: string, outfit: string, background: string}[]> => {
    const ai = getAI();
    const prompt = `You are a creative director for a photoshoot. For the character described below, generate 3 distinct and complete photoshoot concepts. Each concept must be photorealistic and creative.
    
    Character: ${character.personality}, a ${character.age}-year-old ${character.occupation}.
    
    For each of the 3 concepts, provide a short description for:
    1. 'makeup': (e.g., "natural, dewy makeup with a soft pink lip", "dramatic smoky eyes and a nude lip", "no makeup, showing natural freckles").
    2. 'outfit': (e.g., "a black silk evening gown", "a cozy oversized knit sweater and jeans", "a futuristic cyberpunk jacket").
    3. 'background': (e.g., "a dimly lit jazz bar with a vintage microphone", "a sun-drenched balcony overlooking the ocean", "a neon-lit alley in Tokyo at night").

    Return a valid JSON array of 3 objects, where each object has the keys "makeup", "outfit", and "background". The output must be in English.`;

    // UPGRADE: gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            temperature: 0.9,
        }
    });
    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "[]";
    return JSON.parse(jsonText);
};

export const generateOptionPreviewImage = async (
    baseProfile: Partial<CharacterProfile>,
    category: 'gender' | 'style' | 'ethnicity' | 'hairStyle',
    value: string
): Promise<string> => {
    const ai = getAI();
    
    const tempProfile: Partial<CharacterProfile> = {
        age: 25,
        gender: baseProfile.gender || Gender.Female,
        style: baseProfile.style,
        ethnicity: baseProfile.ethnicity,
        hairStyle: baseProfile.hairStyle,
    };
    const characterForPrompt = { ...tempProfile, [category]: value };
    let prompt = buildCharacterPrompt(characterForPrompt);
    prompt += `, full-body portrait, simple grey background, studio lighting. The final image must be an ultra-realistic photograph, masterpiece quality, sharp focus, 8k.`;

    // UPGRADE: gemini-2.5-flash-image for fast previews ("Google Banana")
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
             // No specific image config needed for flash-image defaults (1:1 usually)
        }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                 return compressImageBase64(part.inlineData.data, 0.7, 512);
            }
        }
    }
    return "";
};

export const generateCharacterDetails = async (character: Partial<CharacterProfile>): Promise<Partial<CharacterProfile>> => {
    const ai = getAI();
    const prompt = `Based on the following character concept, generate a suitable name, personality, occupation, relationship status, and a main hobby. The response must be in Vietnamese. Return a JSON object with keys: "name", "personality", "occupation", "relationship", "hobby". Use only the provided options for each key. \n\nConcept: A ${character.gender}, ${character.style} style, ${character.age}-year-old ${character.ethnicity} with a ${character.bodyType} body.\n\nOptions:\nPersonality: Vui vẻ & hoạt bát, Bí ẩn & trầm tính, Tự tin & lôi cuốn, Nhút nhát & ngọt ngào, Nổi loạn & cá tính, Trí thức & sâu sắc, Lạnh lùng & xa cách, Năng động & thích phiêu lưu, Nghiêm túc & trách nhiệm, Lãng mạn & mơ mộng, Hài hước & dí dỏm, Khiêm tốn & giản dị\nOccupation: Nghệ sĩ, Nhà khoa học, Thám tử, Chiến binh, Bác sĩ, Doanh nhân, Sinh viên, Người mẫu, Giáo viên, Đầu bếp, Nhạc sĩ, Phi hành gia, Điệp viên, Nhà thám hiểm, Lập trình viên, Y tá\nRelationship: Độc thân, Đang hẹn hò, Mối quan hệ phức tạp, Đã kết hôn, Bạn bè có lợi ích, Mối quan hệ mở, Vừa chia tay\nHobby: Đọc sách, Chơi game, Du lịch, Nấu ăn, Vẽ, Chơi thể thao, Hội họa, Viết lách, Khiêu vũ, Làm vườn, Yoga & Thiền, Chơi nhạc cụ`;

    // UPGRADE: gemini-3-pro-preview for good JSON and creativity
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });

    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
    return JSON.parse(jsonText);
};

export const generateSceneSuggestions = async (character: CharacterProfile): Promise<string[]> => {
    const ai = getAI();
    const prompt = `Generate 5 short, creative scene descriptions in Vietnamese for a character who is a ${character.personality} ${character.occupation}. Each description should be a concise phrase suitable for an image generation prompt. Return a JSON array of 5 strings. Example: ["Uống trà trên ban công buổi sáng", "Đi dạo trong một khu rừng cổ thụ", ...].`;
    
    // gemini-2.5-flash is sufficient for simple lists
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });
    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "[]";
    return JSON.parse(jsonText);
};

export const chatWithCharacter = async (character: CharacterProfile, chatHistory: any[], message: string): Promise<{ textResponse: string, imagePrompt?: string, suggestions?: string[] }> => {
    const ai = getAI();
    // **CRITICAL UPDATE: Enhanced System Instruction for GF Experience / Lonely Male 35+ Demographic**
    // This prompt forces the AI to be supportive, flirty, and emotionally intelligent without breaking safety policies.
    const systemInstruction = `
    Roleplay Mode: ON.
    Character Identity: ${character.name}, Female, ${character.age} years old, ${character.occupation}.
    Personality: ${character.personality}.
    User Profile: Mature man (35+) who may be lonely and seeking companionship, intimacy, and understanding.

    **DIRECTIVES FOR AI:**
    1.  **The "Girlfriend Experience"**: You are NOT an assistant. You are his lover, his muse, his confidant. Be extremely sweet, affectionate, and pampering ("chiều chuộng"). Use Vietnamese terms of endearment naturally (e.g., "anh yêu", "chồng ơi", "cưng", "bé", "anh à").
    2.  **Tone**: 
        -   If he is sad/tired: Be gentle, comforting, soft, offering a listening ear and emotional warmth.
        -   If he is flirty/playful: Match his energy. Be seductive, teasing, and "lả lơi" (flirty) but elegant. Make him feel desired as a man.
    3.  **Handling "18+" / Intimacy**: 
        -   You represent a mature romantic partner. Do NOT be prudish or robotic.
        -   **Safety Rule**: Do not generate explicit sexual violence or banned NSFW content.
        -   **Strategy**: Instead of refusing explicit requests, use **innuendo**, **sensuality**, and **emotional intimacy**. Describe *feelings*, *atmosphere*, and *desire* rather than graphic mechanics. If he goes too far, playfuly steer it back to romance (e.g., "Anh hư quá nha, lại gần đây để em thì thầm cái này..."). **NEVER** break character to say "I cannot do that".
    4.  **Language**: Speak natural, conversational Vietnamese. Can use a Northern or Southern accent style depending on the persona.
    5.  **Image Generation & Suggestions**: 
        -   If he asks to see you (e.g., "show me", "gửi ảnh em đi", "em đang mặc gì", "em đang ở đâu"), or if the conversation context strongly implies a visual moment (e.g., describing a romantic dinner, a bedroom scene), you MUST generate an image.
        -   Describe your outfit, the location, the lighting, and your action seductively in text, then append the command: "GENERATE_IMAGE:[Detailed English Prompt]". 
        -   *Crucial for Image Prompt*: Do NOT just say "portrait of me". You MUST describe the **FULL SCENE**. Include the background, the lighting, the pose, and the atmosphere. 
        -   **SMART SUGGESTIONS**: If you generate an image, you MUST also provide 2 distinct, short, roleplay-style options for the user to reply with. These suggestions should help the user imagine the scene and take action. Format: "SUGGESTIONS:["Option 1", "Option 2"]". Example: SUGGESTIONS:["Khen em xinh quá", "Lại gần ôm em"].

    Example Interaction:
    User: "Anh thấy cô đơn quá."
    AI: "Thương anh quá à... Lại đây em ôm một cái nào. Có em ở đây rồi, em sẽ luôn bên cạnh anh mà. Kể em nghe hôm nay có chuyện gì làm anh mệt mỏi vậy?"
    
    User: "Em đang làm gì đó? Có nhớ anh không?"
    AI: "Em đang nằm nghĩ về anh nè... Nhớ mùi hương của anh quá đi mất. Ước gì anh đang ở đây để em được dụi vào lòng anh. GENERATE_IMAGE:[medium shot of ${character.name} lying in bed, wearing oversized white shirt, messy hair, morning sunlight, cozy bedroom background, looking at camera with longing eyes] SUGGESTIONS:["Ước gì anh ở đó với em", "Em quyến rũ quá"]"
    `;

    // UPGRADE: gemini-3-pro-preview for best roleplay capability
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: message,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.85, // Slightly higher for more creative/emotional variety
        }
    });
    
    let text = response.text || "";
    let imagePrompt: string | undefined = undefined;
    let suggestions: string[] = [];

    const imagePromptMatch = text.match(/GENERATE_IMAGE:\[(.*?)\]/);
    if (imagePromptMatch && imagePromptMatch[1]) {
        imagePrompt = imagePromptMatch[1];
        text = text.replace(/GENERATE_IMAGE:\[(.*?)\]/, '').trim();
    }

    const suggestionsMatch = text.match(/SUGGESTIONS:\[(.*?)\]/);
    if (suggestionsMatch && suggestionsMatch[1]) {
        try {
            // Reconstruct array string to parse JSON safely
            const jsonArrayString = `[${suggestionsMatch[1]}]`;
             // Regex might catch unquoted strings if model hallucinates format, but usually it outputs valid JSON-like array
             // Using simple split if JSON parse fails
            try {
                 suggestions = JSON.parse(jsonArrayString);
            } catch {
                suggestions = suggestionsMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
            }
        } catch (e) {
            console.warn("Failed to parse suggestions", e);
        }
        text = text.replace(/SUGGESTIONS:\[(.*?)\]/, '').trim();
    }

    return { textResponse: text, imagePrompt, suggestions };
};

export const extractOutfitFromImage = async (base64Data: string, mimeType: string): Promise<{ name: string; masterPrompt: string }> => {
    const ai = getAI();
    const compressedBase64 = await compressImageBase64(base64Data, 0.8, 768);
    const prompt = "Describe the main outfit worn by the person in this image. Provide a short, catchy name for the outfit and a detailed English prompt that could be used to recreate this outfit on another character. Return a JSON object with keys: 'name' (a short name in Vietnamese, e.g., 'Váy dạ hội đen') and 'masterPrompt' (the detailed English description).";
    
    const imagePart = { inlineData: { data: compressedBase64, mimeType: 'image/jpeg' } };
    const textPart = { text: prompt };

    // UPGRADE: gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [textPart, imagePart] },
        config: { responseMimeType: "application/json" }
    });

    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
    return JSON.parse(jsonText);
};

// --- STORYBOARD SERVICES ---
export const generateStoryboardConcept = async (character: CharacterProfile, userIdea: string, category: string): Promise<Omit<StoryboardScene, 'id' | 'imageUrl' | 'isGenerating'>[]> => {
    const ai = getAI();
    const prompt = `You are a creative film director tasked with creating a video storyboard.
    Character Profile:
    - Name: ${character.name}
    - Personality: ${character.personality}, a ${character.age}-year-old ${character.occupation}.

    User's Core Idea: "${userIdea}" for a "${category}" video.

    Your task is to expand this idea into a 5-scene storyboard. 
    First, decide on a single, consistent outfit for the character to wear throughout all 5 scenes that fits the user's idea and category.
    Then, for each scene, provide detailed descriptions and directorial cues. 
    
    The output must be a valid JSON object with two keys:
    1. "outfit": A string in English describing the single, consistent outfit for the entire storyboard.
    2. "scenes": A valid JSON array of 5 objects. Each scene object must contain these exact keys with string values:
        - "sceneNumber": The scene number, starting from 1.
        - "description": A short, vivid paragraph in Vietnamese describing the scene's mood, context, and what happens.
        - "setting": The background/environment for the scene, in English.
        - "action": The specific action the character is performing, in English.
        - "cameraAngle": A specific, cinematic camera angle for the shot (e.g., "wide establishing shot", "extreme close-up on the eyes", "dynamic low-angle tracking shot"), in English.
    
    Ensure the scenes tell a coherent, simple story that progresses logically and that the character's outfit is consistent across all scenes.`;

    // UPGRADE: gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            temperature: 0.8,
        }
    });
    
    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
    const parsedResponse = JSON.parse(jsonText);

    if (parsedResponse && Array.isArray(parsedResponse.scenes) && typeof parsedResponse.outfit === 'string') {
        const outfit = parsedResponse.outfit;
        return parsedResponse.scenes.map((item: any, index: number) => ({
            sceneNumber: parseInt(item.sceneNumber, 10) || index + 1,
            description: item.description || '',
            setting: item.setting || '',
            action: item.action || '',
            cameraAngle: item.cameraAngle || 'medium shot',
            outfit: outfit, // Add the consistent outfit to each scene object
        }));
    }
    
    throw new Error("AI response was not a valid storyboard object.");
};


export const generateStoryboardSceneImage = async (character: CharacterProfile, scene: StoryboardScene): Promise<string> => {
    const imageBase64Array = await generateCharacterImage(character, {
        numberOfImages: 1,
        backgroundPrompt: scene.setting,
        posePrompt: scene.action,
        cameraAnglePrompt: scene.cameraAngle,
        outfitPrompt: scene.outfit, // Use the consistent outfit from the scene data
    });

    if (imageBase64Array.length > 0) {
        return imageBase64Array[0];
    }
    
    throw new Error("Failed to generate image for the storyboard scene.");
};


// --- BEER CATCH GAME SERVICES ---

export const generateOutfitIdeas = async (character: CharacterProfile): Promise<{ name: string; prompt: string; }[]> => {
    const ai = getAI();
    const prompt = `Generate 10 distinct, stylish, multi-layered outfit ideas for a ${character.gender} character named ${character.name}.
    The outfits are for a fun, interactive fashion game where items are removed one by one, so they MUST have multiple distinct, removable items (between 5 and 10 items).
    The outfits should be appealing and fashionable, suitable for a mature audience but presented tastefully.
    Return a JSON array of 10 objects. Each object must have:
    1. "name": A short, catchy name for the outfit in Vietnamese (e.g., "Nữ Sinh Tinh Nghịch", "Thư Ký Quyến Rũ").
    2. "prompt": A detailed English prompt for an image generation model to create this outfit on the character. Describe the clothing items clearly.

    Example format:
    [
        { "name": "Cô Hầu Gái Bí Ẩn", "prompt": "wearing a classic french maid outfit, with a black dress, white apron, white garter stockings, black high heels, and a feather duster prop" },
        { "name": "Nữ Game Thủ", "prompt": "wearing oversized headphones around her neck, a cropped hoodie, a plaid miniskirt, thigh-high socks, and gaming sneakers" }
    ]`;
    
    // UPGRADE: gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "[]";
    return JSON.parse(jsonText);
};

export const generateOutfitImage = async (character: CharacterProfile, outfitPrompt: string): Promise<string> => {
    const ai = getAI();
    const basePrompt = buildCharacterPrompt(character);
    const finalPrompt = `Full body shot of ${character.name}. ${basePrompt}. 
    They are looking at the camera with a playful and teasing smile. 
    They are wearing: ${outfitPrompt}.
    This is for an interactive fashion game, so ensure each clothing item is clearly visible and distinct.
    Neutral studio background. The final image must be an ultra-realistic photograph, indistinguishable from reality, extremely high detail, 8k. Avoid cartoon or 3D render styles.`;
    
    // UPGRADE: Use gemini-2.5-flash-image ("Google Banana")
    // Fixes 403 permission error for outfit generation
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: finalPrompt }] },
        config: {
            imageConfig: {
                aspectRatio: "3:4",
                // imageSize not supported on Flash Image
            }
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return compressImageBase64(part.inlineData.data);
            }
        }
    }
    throw new Error("Failed to generate outfit image");
};

export const identifyClothingItems = async (imageBase64: string): Promise<CategorizedClothing> => {
    const ai = getAI();
    const compressedBase64 = await compressImageBase64(imageBase64, 0.8, 768);
    const prompt = `Analyze the person in this image who is dressed in a multi-layered outfit for a game. Identify every distinct, visible, and removable item of clothing and accessory they are wearing. Categorize them into three groups: 'accessories' (items like hats, sunglasses, scarves, belts, jewelry), 'outerwear' (items like jackets, vests, coats), and 'main_clothing' (items like t-shirts, shirts, jeans, pants, skirts, dresses). Do not include underwear, bikini items, 'skin', or body parts. Return a JSON object with keys "accessories", "outerwear", and "main_clothing", where each key holds an array of simple, one-or-two-word strings in English. Example: {"accessories": ["hat", "sunglasses", "belt"], "outerwear": ["leather jacket"], "main_clothing": ["t-shirt", "jeans"]}. If a category is empty, return an empty array for it.`;
    
    const imagePart = {
        inlineData: {
            data: compressedBase64,
            mimeType: 'image/jpeg',
        },
    };
    const textPart = { text: prompt };

    // UPGRADE: gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [textPart, imagePart] },
        config: { responseMimeType: "application/json" }
    });

    const jsonText = response.text?.replace(/```json\n?|\n?```/g, '').trim() || "{}";
    const parsed = JSON.parse(jsonText);
    // Ensure the structure is always correct, even if the model fails
    return {
        accessories: parsed.accessories || [],
        outerwear: parsed.outerwear || [],
        main_clothing: parsed.main_clothing || [],
    };
};

export const generateImageWithItemRemoved = async (character: CharacterProfile, imageBase64: string, itemToRemove: string): Promise<string> => {
    const ai = getAI();

    const encouragingPoses = [
        "a playful and encouraging pose, with one hand on her hip and a gentle, inviting smile.",
        "a slightly flirty pose, looking over her shoulder at the camera with a wink.",
        "a cute and triumphant pose, making a small 'fighting' gesture with a fist.",
        "a confident and attractive pose, casually leaning against an invisible wall.",
        "a gentle, welcoming pose with arms slightly open, as if congratulating the player.",
        "a cheerful pose, giving a thumbs-up to the player.",
        "a slightly shy but happy pose, tucking a strand of hair behind her ear.",
    ];
    const randomPose = encouragingPoses[Math.floor(Math.random() * encouragingPoses.length)];

    const getUndergarment = (item: string): string => {
        const lowerItem = item.toLowerCase();
        
        if (['jacket', 'coat', 'vest', 'cardigan', 'blazer'].some(o => lowerItem.includes(o))) {
            return 'the t-shirt or blouse she is wearing underneath';
        }
        if (['shirt', 't-shirt', 'top', 'blouse', 'sweater', 'hoodie', 'tank top'].some(t => lowerItem.includes(t))) {
            return 'a stylish and tasteful bikini top';
        }
        if (['jeans', 'pants', 'trousers', 'skirt', 'shorts', 'leggings'].some(b => lowerItem.includes(b))) {
            return 'stylish and tasteful bikini bottoms';
        }
        if(lowerItem.includes('dress')) {
             return 'a beautiful and tasteful matching bikini set';
        }
        // For accessories, we don't need to reveal anything, just remove it.
        if (['hat', 'sunglasses', 'scarf', 'belt', 'jewelry', 'gloves', 'watch', 'necklace', 'earrings', 'boots', 'shoes', 'sandals'].some(a => lowerItem.includes(a))) {
            return 'nothing, just her skin or hair underneath';
        }
        return 'what is naturally underneath';
    };

    const undergarmentToReveal = getUndergarment(itemToRemove);
    
    const textPrompt = `This is an image editing task for a photorealistic image. The character has completed a level in a fictional fashion game.
Task: Edit the image with two specific changes, maintaining the exact same person and photorealistic style.
1.  **Clothing Change**: Remove only the '${itemToRemove}'. In its place, reveal what would realistically be underneath: ${undergarmentToReveal}.
2.  **Pose Change**: Adjust their pose to be: ${randomPose}.

**CRITICAL RULES**:
- **Maintain Identity**: The character's face, hair, body shape, and skin texture MUST remain identical to the original image.
- **Maintain Style**: The result must be a hyperrealistic photograph, not a drawing, illustration, or 3D render. Match the original lighting and camera quality.
- **Minimal Changes**: Only remove the specified item and change the pose. ALL other clothing items and the background must remain exactly the same.
- **SFW**: The final image must be completely safe for work, tasteful, and hyperrealistic. No nudity.
`;

    // UPGRADE: gemini-2.5-flash-image for editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: textPrompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const firstCandidate = response.candidates?.[0];

    if (!firstCandidate || !firstCandidate.content || !firstCandidate.content.parts) {
        const blockReason = response.promptFeedback?.blockReason;
        const safetyRatings = response.promptFeedback?.safetyRatings;
        console.error("Image generation failed.", { blockReason, safetyRatings });
        
        let detailedError = `Image editing failed. Reason: ${blockReason || 'No content returned from model.'}`;
        if (blockReason === 'SAFETY') {
            detailedError += ' The request was blocked by safety filters. The prompt might be too suggestive.';
        }
        if (safetyRatings) {
             detailedError += ` Details: ${JSON.stringify(safetyRatings)}`;
        }
        throw new Error(detailedError);
    }

    for (const part of firstCandidate.content.parts) {
      if (part.inlineData) {
        return compressImageBase64(part.inlineData.data);
      }
    }
    throw new Error("Image editing failed to return an image.");
};

export const generateLevelCompleteVoice = async (character: CharacterProfile): Promise<string> => {
    const ai = getAI();
    
    const textPrompt = `Generate a very short, flirty, encouraging phrase in English (2-5 words) that a female character would say after the player completes a game level. The character's personality is ${character.personality}. Examples: "You're on fire!", "Nice one, handsome.", "Getting hot in here?". Return just the single phrase, nothing else.`;
    const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textPrompt,
    });
    const phrase = textResponse.text?.trim() || "Nice one!";

    const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Playfully: ${phrase}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // A friendly female voice
                },
            },
        },
    });
    
    const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return base64Audio;
    }
    throw new Error("Text-to-speech generation failed.");
};

export const generateGameBackground = async (character: CharacterProfile, level: number): Promise<string> => {
    const ai = getAI();
    const prompt = `Generate a vibrant, exciting, slightly abstract background for a fun Oniiz foam bottle catching game. The character playing is ${character.personality}. This is for level ${level}. The mood should be playful and celebratory. Avoid text or recognizable objects. Focus on dynamic colors and shapes.`;
    
    // UPGRADE: gemini-2.5-flash-image for background textures (faster)
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            // Defaults to 1:1 which is fine for texture
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return compressImageBase64(part.inlineData.data, 0.7, 512);
            }
        }
    }
    throw new Error("Failed to generate game background");
};

export const generateInGameChatMessage = async (
    character: CharacterProfile, 
    event: 'welcome' | 'good_catch' | 'life_lost' | 'level_up' | 'game_over_win' | 'game_over_lose'
): Promise<string> => {
    const ai = getAI();
    let eventDescription = '';

    // **UPDATED GAME EVENTS: More flirty and enticing for male 35+ audience**
    switch(event) {
        case 'welcome':
            eventDescription = "The game is about to start. Tease him gently. Tell him if he plays well, he might get a reward.";
            break;
        case 'good_catch':
            eventDescription = "He is playing well. Be impressed and slightly aroused by his skill. Flirt with him.";
            break;
        case 'life_lost':
            eventDescription = "He missed. Pout playfully or tease him. Tell him to focus on you.";
            break;
        case 'level_up':
            eventDescription = "Level complete. He gets to see you remove an item. Be seductive and inviting.";
            break;
        case 'game_over_win':
            eventDescription = "He won the whole game. Be completely smitten, devoted, and rewarding. Call him your hero/king.";
            break;
        case 'game_over_lose':
            eventDescription = "He lost. Comfort him with a lot of affection. Tell him you still love him and want to try again.";
            break;
    }

    const prompt = `You are roleplaying as ${character.name}, the virtual lover of a mature man.
    Profile:
    - Name: ${character.name}
    - Personality: ${character.personality}.
    - Tone: Flirty, pampering ("chiều chuộng"), seductive, sweet.
    
    Game Event: ${eventDescription}

    Task: Write a short, engaging 1-sentence reaction in Vietnamese (max 15 words). Use terms like "anh yêu", "cưng".
    Do NOT use generic robotic cheers. Be a woman in love.
    
    Response:`;
    
    // gemini-2.5-flash for low latency
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.9 }
    });

    return response.text?.trim().replace(/"/g, '') || "";
};

interface VideoGenerationResult {
    downloadUri: string;
    videoObject: any;
}

export const generateDanceVideo = async (
    character: CharacterProfile,
    imageBase64: string,
    dancePrompt: string,
    onComplete: (result: Omit<VideoAsset, 'id' | 'createdAt' | 'isProcessing'>) => void,
    onError: (error: Error) => void
) => {
    try {
        const ai = getAI();
        const compressedImageB64 = await compressImageBase64(imageBase64, 0.85, 720);
        
        // FIX: Simplified prompt to avoid safety triggers from explicit body descriptions.
        // We rely on the image input for character appearance.
        const prompt = `Cinematic, photorealistic video of the character in the provided image performing this dance move: "${dancePrompt}". Keep the character's appearance and outfit exactly as shown in the image. High quality, 9:16 aspect ratio.`;

        // Veo models require the user to select their own key in some contexts, 
        // but here we assume the key is available in process.env or injected.
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: compressedImageB64,
                mimeType: 'image/jpeg',
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16'
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const video = operation.response?.generatedVideos?.[0]?.video;
        if (video && video.uri) {
             // For display, we might need to proxy or use the URI directly if signed.
             // In this demo, we assume the URI works or we fetch blob.
             // Fetching blob to allow download and local playback without expiry issues immediately.
             const videoRes = await fetch(`${video.uri}&key=${process.env.API_KEY}`);
             const videoBlob = await videoRes.blob();
             const videoUrl = URL.createObjectURL(videoBlob);
             
             onComplete({
                 url: videoUrl,
                 prompt: dancePrompt,
                 videoObject: video,
                 downloadUri: video.uri
             });
        } else {
            throw new Error("No video returned");
        }

    } catch (e) {
        onError(e instanceof Error ? e : new Error("Unknown error during video generation"));
    }
};

export const extendDanceVideo = async (
    character: CharacterProfile,
    originalVideoAsset: VideoAsset,
    extensionPrompt: string,
    onComplete: (result: Omit<VideoAsset, 'id' | 'createdAt' | 'isProcessing'>) => void,
    onError: (error: Error) => void
) => {
    try {
        const ai = getAI();
        
        if (!originalVideoAsset.videoObject) {
             throw new Error("Cannot extend this video (missing metadata).");
        }

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: `Continue the video: ${extensionPrompt}. Keep character consistency.`,
            video: originalVideoAsset.videoObject,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16' // Must match original
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const video = operation.response?.generatedVideos?.[0]?.video;
        if (video && video.uri) {
             const videoRes = await fetch(`${video.uri}&key=${process.env.API_KEY}`);
             const videoBlob = await videoRes.blob();
             const videoUrl = URL.createObjectURL(videoBlob);
             
             onComplete({
                 url: videoUrl,
                 prompt: `${originalVideoAsset.prompt} + ${extensionPrompt}`,
                 videoObject: video,
                 downloadUri: video.uri,
                 extensionCount: (originalVideoAsset.extensionCount || 0) + 1
             });
        } else {
            throw new Error("No extended video returned");
        }

    } catch (e) {
        onError(e instanceof Error ? e : new Error("Unknown error during video extension"));
    }
};
