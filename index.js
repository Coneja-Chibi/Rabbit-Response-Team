import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const { eventSource, event_types } = SillyTavern.getContext();

const extensionName = 'RabbitNumeralRandomizer';
const extensionFolderPath = `third-party/${extensionName}`;

// Fallback word bank (113 words from various API calls)
const FALLBACK_WORD_BANK = [
    'whisper', 'shadow', 'echo', 'mirror', 'silver', 'golden', 'crystal', 'velvet', 'silk', 'thunder',
    'lightning', 'storm', 'rain', 'ocean', 'river', 'mountain', 'forest', 'meadow', 'garden', 'blossom',
    'petal', 'thorn', 'ember', 'flame', 'spark', 'glow', 'shimmer', 'glimmer', 'gleam', 'radiant',
    'brilliant', 'luminous', 'dazzling', 'splendid', 'exquisite', 'elegant', 'graceful', 'delicate', 'tender', 'gentle',
    'fierce', 'bold', 'brave', 'daring', 'wild', 'untamed', 'savage', 'primal', 'ancient', 'eternal',
    'infinite', 'boundless', 'endless', 'vast', 'immense', 'profound', 'deep', 'dark', 'light', 'bright',
    'vivid', 'vibrant', 'lively', 'spirited', 'passionate', 'fervent', 'ardent', 'zealous', 'eager', 'keen',
    'sharp', 'swift', 'quick', 'rapid', 'sudden', 'abrupt', 'hasty', 'urgent', 'pressing', 'crucial',
    'vital', 'essential', 'fundamental', 'basic', 'simple', 'plain', 'bare', 'naked', 'raw', 'crude',
    'rough', 'smooth', 'soft', 'hard', 'solid', 'liquid', 'fluid', 'flowing', 'rushing', 'surging',
    'rising', 'falling', 'soaring', 'plunging', 'diving', 'swimming', 'floating', 'drifting', 'wandering', 'roaming',
    'seeking', 'searching', 'hunting', 'chasing', 'pursuing', 'following', 'trailing', 'tracking', 'tracing'
];

// API configurations
const API_CONFIGS = {
    heroku: {
        name: 'Heroku (Multi-language)',
        url: 'https://random-word-api.herokuapp.com/word',
        params: ['number', 'length', 'lang']
    },
    vercel: {
        name: 'Vercel (Advanced Filters)',
        url: 'https://random-word-api.vercel.app/api',
        params: ['words', 'length', 'letter', 'alphabetize']
    },
    datamuse: {
        name: 'Datamuse (Part of Speech)',
        url: 'https://api.datamuse.com/words',
        params: ['max', 'sp', 'md']
    }
};

// Default prompt templates
const DEFAULT_RANDOM_PROMPT = `[OOC NARRATIVE OVERDRIVE: You must naturally incorporate the following words into your response: {{words}}. Use each word at least once, weaving them seamlessly into the narrative flow. DO NOT bold, italicize, or add any visual indicators around these words - they must appear as normal text, indistinguishable from the rest of your writing.]`;

const DEFAULT_SYNONYM_PROMPT = `[OOC WORD FRESHNESS: The word "{{originalWord}}" has been used frequently. For variety and freshness, try using these synonyms instead: {{synonyms}}. Weave them naturally into your response.]`;

// Common stopwords to exclude from synonym detection
const DEFAULT_STOPWORDS = new Set([
    // Articles, conjunctions, prepositions
    'the', 'and', 'but', 'for', 'nor', 'yet', 'with', 'from', 'into', 'upon', 'about', 'above', 'below',
    'under', 'over', 'between', 'through', 'during', 'before', 'after', 'since', 'until', 'while',
    // Common verbs and auxiliaries
    'have', 'has', 'had', 'been', 'being', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
    'must', 'shall', 'does', 'did', 'doing', 'make', 'made', 'makes', 'making',
    // Pronouns
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
    // Common adjectives/adverbs
    'very', 'really', 'quite', 'just', 'only', 'even', 'also', 'still', 'already', 'always', 'never',
    'often', 'sometimes', 'usually', 'however', 'therefore', 'thus', 'hence', 'moreover', 'furthermore',
    // Other common words
    'there', 'here', 'then', 'than', 'such', 'some', 'any', 'each', 'every', 'both', 'either', 'neither',
    'much', 'many', 'more', 'most', 'less', 'least', 'few', 'several', 'enough', 'same', 'other', 'another'
]);

// Default settings (nested structure)
const defaultSettings = {
    randomWords: {
        enabled: false,
        wordCount: 3,
        useAPI: true,
        apiProvider: 'vercel', // 'heroku', 'vercel', or 'datamuse'
        fallbackToGenerated: true,

        // Prompt customization
        customPrompt: DEFAULT_RANDOM_PROMPT,
        injectionDepth: 0,
        injectionEndRole: 'system',

        // Shared settings
        wordLength: 0, // 0 = any length

        // Heroku-specific
        language: 'en',

        // Vercel-specific
        vercelFirstLetter: '',
        alphabetize: false,

        // Datamuse-specific
        partOfSpeechNoun: true,
        partOfSpeechVerb: true,
        partOfSpeechAdj: true,
        partOfSpeechAdv: false,
        datamuseMode: 'random', // 'random' or 'contextual'
        relationshipType: 'trg',
        themeWords: '',
        datamuseFirstLetter: '', // a-z or empty
        wordCommonness: 50, // 0 = rare words only, 50 = mix, 100 = common words only
        includeDefinitions: false, // Include word definitions in the prompt
        doublePass: false, // Pick 1 word, theme rest around it

        // Advanced features
        wordBlacklist: '',
        historySize: 20,
        minMessageLength: 0,
        showLastWords: true
    },
    synonyms: {
        enabled: false,
        scanDepth: 3, // Last N messages to scan
        minOccurrences: 2, // Word must appear X times
        scanSource: 'both', // 'ai', 'user', 'both'
        synonymCount: 3, // How many synonyms to provide
        excludeWords: '', // User-defined words to exclude from detection (comma-separated)
        customPrompt: DEFAULT_SYNONYM_PROMPT,
        injectionDepth: 0,
        injectionEndRole: 'system'
    }
};

// Word history tracking (stored in memory, not saved)
let wordHistory = [];

// Load settings
function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = JSON.parse(JSON.stringify(defaultSettings));
    }

    const settings = extension_settings[extensionName];
    let needsSave = false;

    // MIGRATION: Convert old flat structure to new nested structure
    if (settings.enabled !== undefined && !settings.randomWords) {
        console.log('🐰 Rabbit Response Team: Migrating old settings to new nested structure');

        const oldSettings = { ...settings };
        extension_settings[extensionName] = JSON.parse(JSON.stringify(defaultSettings));
        const newSettings = extension_settings[extensionName];

        // Migrate randomWords settings
        newSettings.randomWords.enabled = oldSettings.enabled ?? false;
        newSettings.randomWords.wordCount = oldSettings.wordCount ?? 3;
        newSettings.randomWords.useAPI = oldSettings.useAPI ?? true;
        newSettings.randomWords.apiProvider = oldSettings.apiProvider ?? 'vercel';
        newSettings.randomWords.fallbackToGenerated = oldSettings.fallbackToGenerated ?? true;
        newSettings.randomWords.customPrompt = oldSettings.customPrompt ?? DEFAULT_RANDOM_PROMPT;
        newSettings.randomWords.injectionDepth = oldSettings.injectionDepth ?? 0;
        newSettings.randomWords.injectionEndRole = oldSettings.injectionEndRole ?? 'system';
        newSettings.randomWords.wordLength = oldSettings.wordLength ?? 0;
        newSettings.randomWords.language = oldSettings.language ?? 'en';
        newSettings.randomWords.vercelFirstLetter = oldSettings.firstLetter ?? '';
        newSettings.randomWords.alphabetize = oldSettings.alphabetize ?? false;
        newSettings.randomWords.partOfSpeechNoun = oldSettings.partOfSpeechNoun ?? true;
        newSettings.randomWords.partOfSpeechVerb = oldSettings.partOfSpeechVerb ?? true;
        newSettings.randomWords.partOfSpeechAdj = oldSettings.partOfSpeechAdj ?? true;
        newSettings.randomWords.partOfSpeechAdv = oldSettings.partOfSpeechAdv ?? false;
        newSettings.randomWords.datamuseMode = oldSettings.datamuseMode ?? 'random';
        newSettings.randomWords.relationshipType = oldSettings.relationshipType ?? 'trg';
        newSettings.randomWords.themeWords = oldSettings.themeWords ?? '';
        newSettings.randomWords.wordCommonness = oldSettings.wordCommonness ?? 50;
        newSettings.randomWords.includeDefinitions = oldSettings.includeDefinitions ?? false;
        newSettings.randomWords.wordBlacklist = oldSettings.wordBlacklist ?? '';
        newSettings.randomWords.historySize = oldSettings.historySize ?? 20;
        newSettings.randomWords.minMessageLength = oldSettings.minMessageLength ?? 0;
        newSettings.randomWords.showLastWords = oldSettings.showLastWords ?? true;

        needsSave = true;
        console.log('🐰 Rabbit Response Team: Migration complete');
    }

    // Merge any missing default settings (for users upgrading)
    function mergeDefaults(target, defaults) {
        for (const key in defaults) {
            if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && defaults[key] !== null) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                if (mergeDefaults(target[key], defaults[key])) {
                    needsSave = true;
                }
            } else if (target[key] === undefined) {
                target[key] = defaults[key];
                needsSave = true;
                console.log(`🐰 Rabbit Response Team: Added missing setting '${key}' with default value`);
            }
        }
        return needsSave;
    }

    mergeDefaults(settings, defaultSettings);

    // Save merged settings
    if (needsSave) {
        saveSettingsDebounced();
    }

    // Update UI if it exists
    const rw = settings.randomWords;
    const syn = settings.synonyms;

    // Random Words tab
    $('#rabbit_random_enabled').prop('checked', rw.enabled);
    $('#rabbit_word_count').val(rw.wordCount);
    $('#rabbit_word_count_value').text(rw.wordCount);
    $('#rabbit_use_api').prop('checked', rw.useAPI);
    $('#rabbit_api_provider').val(rw.apiProvider);
    $('#rabbit_fallback').prop('checked', rw.fallbackToGenerated);
    $('#rabbit_custom_prompt').val(rw.customPrompt || DEFAULT_RANDOM_PROMPT);
    $('#rabbit_injection_depth').val(rw.injectionDepth ?? 0);
    $('#rabbit_injection_end_role').val(rw.injectionEndRole || 'system');
    $('#rabbit_word_blacklist').val(rw.wordBlacklist || '');
    $('#rabbit_history_size').val(rw.historySize ?? 20);
    $('#rabbit_min_message_length').val(rw.minMessageLength ?? 0);
    $('#rabbit_show_last_words').prop('checked', rw.showLastWords ?? true);
    $('#rabbit_word_length').val(rw.wordLength);
    $('#rabbit_word_length_value').text(rw.wordLength === 0 ? 'Any' : rw.wordLength);

    // Heroku-specific
    $('#rabbit_language').val(rw.language);

    // Vercel-specific
    $('#rabbit_vercel_first_letter').val(rw.vercelFirstLetter);
    $('#rabbit_alphabetize').prop('checked', rw.alphabetize);

    // Datamuse-specific
    $('#rabbit_pos_noun').prop('checked', rw.partOfSpeechNoun ?? true);
    $('#rabbit_pos_verb').prop('checked', rw.partOfSpeechVerb ?? true);
    $('#rabbit_pos_adj').prop('checked', rw.partOfSpeechAdj ?? true);
    $('#rabbit_pos_adv').prop('checked', rw.partOfSpeechAdv ?? false);
    $('#rabbit_datamuse_mode').val(rw.datamuseMode || 'random');
    $('#rabbit_relationship_type').val(rw.relationshipType || 'trg');
    $('#rabbit_theme_words').val(rw.themeWords || '');
    $('#rabbit_datamuse_first_letter').val(rw.datamuseFirstLetter || '');
    $('#rabbit_word_commonness').val(rw.wordCommonness ?? 50);
    $('#rabbit_word_commonness_value').text(rw.wordCommonness ?? 50);
    $('#rabbit_include_definitions').prop('checked', rw.includeDefinitions ?? false);
    $('#rabbit_double_pass').prop('checked', rw.doublePass ?? false);

    // Synonyms tab
    $('#rabbit_synonym_enabled').prop('checked', syn.enabled);
    $('#rabbit_scan_depth').val(syn.scanDepth ?? 3);
    $('#rabbit_min_occurrences').val(syn.minOccurrences ?? 2);
    $('#rabbit_scan_source').val(syn.scanSource || 'both');
    $('#rabbit_synonym_count').val(syn.synonymCount ?? 3);
    $('#rabbit_exclude_words').val(syn.excludeWords || '');
    $('#rabbit_synonym_prompt').val(syn.customPrompt || DEFAULT_SYNONYM_PROMPT);
    $('#rabbit_synonym_injection_depth').val(syn.injectionDepth ?? 0);
    $('#rabbit_synonym_injection_end_role').val(syn.injectionEndRole || 'system');

    // Show/hide API-specific options
    updateAPIOptions();
    updateDatamuseMode();

    console.log('🐰 Rabbit Response Team: Settings loaded', settings);
}

// Save settings
function saveSettings() {
    const settings = extension_settings[extensionName];
    const rw = settings.randomWords;
    const syn = settings.synonyms;

    // Random Words settings
    rw.enabled = $('#rabbit_random_enabled').prop('checked');
    rw.wordCount = parseInt($('#rabbit_word_count').val());
    rw.useAPI = $('#rabbit_use_api').prop('checked');
    rw.apiProvider = $('#rabbit_api_provider').val();
    rw.fallbackToGenerated = $('#rabbit_fallback').prop('checked');
    rw.customPrompt = $('#rabbit_custom_prompt').val();
    rw.injectionDepth = parseInt($('#rabbit_injection_depth').val());
    rw.injectionEndRole = $('#rabbit_injection_end_role').val();
    rw.wordBlacklist = $('#rabbit_word_blacklist').val();
    rw.historySize = parseInt($('#rabbit_history_size').val()) || 0;
    rw.minMessageLength = parseInt($('#rabbit_min_message_length').val()) || 0;
    rw.showLastWords = $('#rabbit_show_last_words').prop('checked');
    rw.wordLength = parseInt($('#rabbit_word_length').val());
    rw.language = $('#rabbit_language').val();
    rw.vercelFirstLetter = $('#rabbit_vercel_first_letter').val();
    rw.alphabetize = $('#rabbit_alphabetize').prop('checked');
    rw.partOfSpeechNoun = $('#rabbit_pos_noun').prop('checked');
    rw.partOfSpeechVerb = $('#rabbit_pos_verb').prop('checked');
    rw.partOfSpeechAdj = $('#rabbit_pos_adj').prop('checked');
    rw.partOfSpeechAdv = $('#rabbit_pos_adv').prop('checked');
    rw.datamuseMode = $('#rabbit_datamuse_mode').val();
    rw.relationshipType = $('#rabbit_relationship_type').val();
    rw.themeWords = $('#rabbit_theme_words').val();
    rw.datamuseFirstLetter = $('#rabbit_datamuse_first_letter').val();
    rw.wordCommonness = parseInt($('#rabbit_word_commonness').val()) || 50;
    rw.includeDefinitions = $('#rabbit_include_definitions').prop('checked');
    rw.doublePass = $('#rabbit_double_pass').prop('checked');

    // Synonyms settings
    syn.enabled = $('#rabbit_synonym_enabled').prop('checked');
    syn.scanDepth = parseInt($('#rabbit_scan_depth').val()) || 3;
    syn.minOccurrences = parseInt($('#rabbit_min_occurrences').val()) || 2;
    syn.scanSource = $('#rabbit_scan_source').val();
    syn.synonymCount = parseInt($('#rabbit_synonym_count').val()) || 3;
    syn.excludeWords = $('#rabbit_exclude_words').val();
    syn.customPrompt = $('#rabbit_synonym_prompt').val();
    syn.injectionDepth = parseInt($('#rabbit_synonym_injection_depth').val()) || 0;
    syn.injectionEndRole = $('#rabbit_synonym_injection_end_role').val();

    saveSettingsDebounced();
    console.log('🐰 Rabbit Response Team: Settings saved', settings);
}

// Update API-specific options visibility
function updateAPIOptions() {
    // Read DIRECTLY from the dropdown, not from settings
    const provider = $('#rabbit_api_provider').val() || 'vercel';
    const container = $('#rabbit-settings-body');

    // Set a data attribute on the container
    container.attr('data-api-provider', provider);
}

// Update Datamuse mode visibility
function updateDatamuseMode() {
    const mode = $('#rabbit_datamuse_mode').val() || 'random';
    const container = $('#rabbit-settings-body');

    // Set a data attribute on the container for CSS
    container.attr('data-datamuse-mode', mode);
}

// Get random words from fallback bank
function getRandomFallbackWords(count) {
    const shuffled = [...FALLBACK_WORD_BANK].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Extract a random meaningful word from the last user message
async function extractRandomWordFromMessage() {
    try {
        const context = getContext();
        const chat = context.chat;

        if (!chat || chat.length === 0) return null;

        // Find the last user message
        let lastUserMessage = null;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) {
                lastUserMessage = chat[i].mes;
                break;
            }
        }

        if (!lastUserMessage) return null;

        // Common words to filter out (articles, prepositions, pronouns, etc.)
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'should', 'could', 'can', 'may', 'might', 'must', 'i', 'you',
            'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
            'our', 'their', 'this', 'that', 'these', 'those', 'what', 'which',
            'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some'
        ]);

        // Extract words: lowercase, remove punctuation, filter stopwords
        const words = lastUserMessage
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length >= 3 && !stopWords.has(word));

        if (words.length === 0) return null;

        // Pick a random word
        const randomWord = words[Math.floor(Math.random() * words.length)];
        return randomWord;
    } catch (error) {
        console.error('🐰 Rabbit Response Team: Error extracting word from message:', error);
        return null;
    }
}

// Fetch random words from API
async function fetchRandomWordsFromAPI(count) {
    const settings = extension_settings[extensionName].randomWords;
    const provider = settings.apiProvider;
    const config = API_CONFIGS[provider];

    // Build URL with parameters based on provider
    let url = config.url;
    const params = new URLSearchParams();

    if (provider === 'heroku') {
        // Heroku API parameters
        params.append('number', count);

        if (settings.wordLength > 0) {
            params.append('length', settings.wordLength);
        }

        if (settings.language && settings.language !== 'en') {
            params.append('lang', settings.language);
        }
    } else if (provider === 'vercel') {
        // Vercel API parameters
        params.append('words', count);

        if (settings.wordLength > 0) {
            params.append('length', settings.wordLength);
        }

        if (settings.vercelFirstLetter) {
            params.append('letter', settings.vercelFirstLetter.toLowerCase());
        }

        if (settings.alphabetize) {
            params.append('alphabetize', 'true');
        }
    } else if (provider === 'datamuse') {
        // Datamuse API parameters
        const fetchCount = Math.max(count * 10, 50); // Fetch more for better filtering
        params.append('max', fetchCount);

        // Request metadata: part-of-speech + frequency + definitions (if enabled)
        const metadataFlags = settings.includeDefinitions ? 'pfd' : 'pf';
        params.append('md', metadataFlags);

        // Handle contextual mode vs random mode
        if (settings.datamuseMode === 'contextual') {
            // Extract random word from last user message for contextual mode
            const contextWord = await extractRandomWordFromMessage();
            if (contextWord) {
                const relType = settings.relationshipType || 'trg';
                params.append(`rel_${relType}`, contextWord);
                console.log(`🐰 Rabbit Response Team: Using contextual mode with word "${contextWord}" and relationship "${relType}"`);
            } else {
                console.warn('🐰 Rabbit Response Team: No words found in message, falling back to random mode');
                params.append('sp', '*');
            }
        } else {
            // Random mode - use wildcard pattern
            let pattern = '';

            // First letter filter (e.g., 'b' -> 'b*')
            if (settings.datamuseFirstLetter) {
                pattern = settings.datamuseFirstLetter.toLowerCase() + '*';
            } else if (settings.wordLength > 0) {
                pattern = '?'.repeat(settings.wordLength);
            } else {
                pattern = '*'; // Any word
            }

            params.append('sp', pattern);

            // Add theme words if specified (up to 5, comma-separated)
            if (settings.themeWords && settings.themeWords.trim()) {
                const themes = settings.themeWords.split(',').map(t => t.trim()).filter(t => t).slice(0, 5);
                if (themes.length > 0) {
                    params.append('topics', themes.join(','));
                }
            }
        }
    }

    url += '?' + params.toString();

    try {
        console.log('🐰 Rabbit Response Team: Fetching from', url);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        let words = await response.json();
        console.log('🐰 Rabbit Response Team: Fetched from API:', words);

        // Handle Datamuse response (array of objects with word and tags)
        if (provider === 'datamuse' && Array.isArray(words)) {
            // Filter by part of speech
            const allowedPOS = [];
            if (settings.partOfSpeechNoun) allowedPOS.push('n');
            if (settings.partOfSpeechVerb) allowedPOS.push('v');
            if (settings.partOfSpeechAdj) allowedPOS.push('adj');
            if (settings.partOfSpeechAdv) allowedPOS.push('adv');

            // If no POS selected, allow all (safety check)
            if (allowedPOS.length === 0) {
                console.warn('🐰 Rabbit Response Team: No part-of-speech selected, allowing all types');
                allowedPOS.push('n', 'v', 'adj', 'adv', 'u');
            }

            // Filter by POS and extract frequency + definitions
            words = words.filter(item => {
                if (!item.tags || item.tags.length === 0) return false;
                return item.tags.some(tag => allowedPOS.includes(tag));
            }).map(item => {
                // Extract frequency from tags (format: "f:4.177003")
                const freqTag = item.tags.find(tag => tag.startsWith('f:'));
                const frequency = freqTag ? parseFloat(freqTag.split(':')[1]) : 0;

                // Extract definitions if available (array of strings)
                const definitions = item.defs || [];

                return { word: item.word, frequency, definitions };
            });

            // Filter by word commonness (single slider: 0-100)
            // frequency is per million words. Higher = more common.
            const commonness = settings.wordCommonness ?? 50;

            if (commonness < 34) {
                // 0-33: Prefer rare words (low frequency)
                // Keep words with frequency < 1.0 per million
                words = words.filter(item => {
                    if (item.frequency === 0) return true; // Keep words without frequency data
                    return item.frequency < 1.0;
                });
            } else if (commonness > 66) {
                // 67-100: Prefer common words (high frequency)
                // Keep words with frequency > 5.0 per million
                words = words.filter(item => {
                    if (item.frequency === 0) return false; // Exclude words without frequency data
                    return item.frequency > 5.0;
                });
            }
            // 34-66: Mix of both (no filtering)

            // Shuffle and extract results
            words = words.sort(() => Math.random() - 0.5).slice(0, count);

            // Format with definitions if enabled
            if (settings.includeDefinitions) {
                // Store both word and definition for later use
                words = words.map(item => {
                    if (item.definitions && item.definitions.length > 0) {
                        // Format: "word (definition)"
                        const def = item.definitions[0]; // Use first definition
                        return { word: item.word, definition: def };
                    }
                    return { word: item.word, definition: null };
                });
            } else {
                // Extract just the word strings
                words = words.map(item => item.word);
            }
        }

        return Array.isArray(words) ? words : [words];
    } catch (error) {
        console.error('🐰 Rabbit Response Team: API fetch failed:', error);
        return null;
    }
}

// Fetch words themed around a specific word (for double pass)
async function fetchRandomWordsFromAPIWithTheme(count, themeWord) {
    const settings = extension_settings[extensionName].randomWords;
    const url = 'https://api.datamuse.com/words';
    const params = new URLSearchParams();

    params.append('max', Math.max(count * 10, 50));
    params.append('md', 'pf');

    // Use relationship type to find related words
    const relType = settings.relationshipType || 'syn';
    params.append(`rel_${relType}`, themeWord);

    const fullUrl = url + '?' + params.toString();

    try {
        console.log(`🐰 Rabbit Response Team: Fetching themed words from ${fullUrl}`);
        const response = await fetch(fullUrl);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        let words = await response.json();

        if (Array.isArray(words)) {
            // Filter by part of speech
            const allowedPOS = [];
            if (settings.partOfSpeechNoun) allowedPOS.push('n');
            if (settings.partOfSpeechVerb) allowedPOS.push('v');
            if (settings.partOfSpeechAdj) allowedPOS.push('adj');
            if (settings.partOfSpeechAdv) allowedPOS.push('adv');

            if (allowedPOS.length === 0) {
                allowedPOS.push('n', 'v', 'adj', 'adv', 'u');
            }

            words = words.filter(item => {
                if (!item.tags || item.tags.length === 0) return false;
                return item.tags.some(tag => allowedPOS.includes(tag));
            }).map(item => item.word);

            // Shuffle and pick random subset
            words = words.sort(() => Math.random() - 0.5).slice(0, count);
            return words;
        }

        return [];
    } catch (error) {
        console.error('🐰 Rabbit Response Team: Themed API fetch failed:', error);
        return [];
    }
}

// Check if a word is blacklisted
function isBlacklisted(wordItem) {
    const settings = extension_settings[extensionName];
    const blacklist = settings?.randomWords?.wordBlacklist;
    if (!blacklist || blacklist.trim() === '') return false;

    // Extract word string (handle both object and string format)
    const word = typeof wordItem === 'object' ? wordItem.word : wordItem;
    const blacklistedWords = blacklist.toLowerCase().split(',').map(w => w.trim());
    return blacklistedWords.includes(word.toLowerCase());
}

// Check if a word was recently used
function isRecentlyUsed(wordItem) {
    const settings = extension_settings[extensionName];
    const historySize = settings?.randomWords?.historySize || 0;
    if (historySize === 0) return false;

    // Extract word string (handle both object and string format)
    const word = typeof wordItem === 'object' ? wordItem.word : wordItem;
    return wordHistory.some(w => w.toLowerCase() === word.toLowerCase());
}

// Add words to history
function addToHistory(words) {
    const settings = extension_settings[extensionName];
    const historySize = settings?.randomWords?.historySize || 0;
    if (historySize === 0) return;

    // Extract word strings and add to history (ignore definitions for history tracking)
    const wordStrings = words.map(w => typeof w === 'object' ? w.word : w);
    wordHistory.push(...wordStrings);

    // Trim to max size (keep most recent)
    if (wordHistory.length > historySize) {
        wordHistory = wordHistory.slice(-historySize);
    }

    console.log(`🐰 Rabbit Response Team: History now has ${wordHistory.length} words: [${wordHistory.slice(-5).join(', ')}...]`);
}

// Filter out blacklisted and recently used words
function filterWords(words) {
    return words.filter(wordItem => {
        const word = typeof wordItem === 'object' ? wordItem.word : wordItem;
        if (isBlacklisted(wordItem)) {
            console.log(`🐰 Rabbit Response Team: Skipping blacklisted word: "${word}"`);
            return false;
        }
        if (isRecentlyUsed(wordItem)) {
            console.log(`🐰 Rabbit Response Team: Skipping recently used word: "${word}"`);
            return false;
        }
        return true;
    });
}

// Get truly random words
async function getRandomWords(count) {
    const settings = extension_settings[extensionName].randomWords;
    const useAPI = settings.useAPI;
    const fallback = settings.fallbackToGenerated;
    const maxAttempts = 20;
    let attempts = 0;
    let validWords = [];

    console.log(`🐰 Rabbit Response Team: Getting ${count} words (history size: ${wordHistory.length}/${settings.historySize})`);

    // DOUBLE PASS MODE: Get 1 word first, then theme rest around it
    if (settings.doublePass && settings.apiProvider === 'datamuse' && count > 1 && useAPI) {
        console.log('🐰 Rabbit Response Team: Using DOUBLE PASS mode');

        // Get first word using current mode
        const firstWords = await fetchRandomWordsFromAPI(1);
        if (firstWords && firstWords.length > 0) {
            const firstItem = firstWords[0];
            // Extract word string (handle both object and string format)
            const themeWord = typeof firstItem === 'object' ? firstItem.word : firstItem;
            console.log(`🐰 Rabbit Response Team: Double pass theme word: "${themeWord}"`);

            // Temporarily modify settings to use synonym mode with theme word
            const originalMode = settings.datamuseMode;
            const originalRel = settings.relationshipType;

            settings.datamuseMode = 'contextual';
            settings.relationshipType = settings.relationshipType || 'syn'; // Use current relationship type or default to syn

            // Fetch remaining words themed around first word
            const themedWords = await fetchRandomWordsFromAPIWithTheme(count - 1, themeWord);

            // Restore original settings
            settings.datamuseMode = originalMode;
            settings.relationshipType = originalRel;

            if (themedWords && themedWords.length > 0) {
                validWords.push(firstItem, ...themedWords);
                // Filter and add to history
                validWords = filterWords(validWords);
                addToHistory(validWords);
                const displayWords = validWords.map(w => typeof w === 'object' ? w.word : w);
                console.log(`🐰 Rabbit Response Team: Double pass complete: [${displayWords.join(', ')}]`);
                return validWords.slice(0, count);
            }
        }

        console.warn('🐰 Rabbit Response Team: Double pass failed, falling back to normal mode');
    }

    // NORMAL MODE
    while (validWords.length < count && attempts < maxAttempts) {
        attempts++;
        let newWords = [];

        // Try API first if enabled
        if (useAPI) {
            const words = await fetchRandomWordsFromAPI(count - validWords.length);
            if (words && words.length > 0) {
                newWords = words;
            } else if (!fallback) {
                console.warn('🐰 Rabbit Response Team: API failed and fallback disabled');
                break;
            }
        }

        // Fallback to word bank if needed
        if (newWords.length === 0 && fallback) {
            console.log('🐰 Rabbit Response Team: Using fallback word bank');
            newWords = getRandomFallbackWords(count - validWords.length);
        }

        // Filter out blacklisted and recently used words
        const filtered = filterWords(newWords);
        validWords.push(...filtered);
    }

    // If we couldn't get enough words after all attempts, allow some repeats
    if (validWords.length < count && fallback) {
        console.warn(`🐰 Rabbit Response Team: Only found ${validWords.length}/${count} words after ${maxAttempts} attempts. Allowing repeats from fallback bank.`);

        // Get remaining words from fallback without filtering history
        const remaining = count - validWords.length;
        const unfiltered = getRandomFallbackWords(remaining);
        validWords.push(...unfiltered);
    }

    // Add to history
    addToHistory(validWords);

    const displayWords = validWords.map(w => typeof w === 'object' ? w.word : w);
    console.log(`🐰 Rabbit Response Team: Returning ${validWords.length} words: [${displayWords.join(', ')}]`);
    return validWords.slice(0, count);
}

// Inject words into prompt - EPHEMERAL, at the VERY BOTTOM
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (eventData) => {
    const settings = extension_settings[extensionName];
    const rw = settings.randomWords;
    const syn = settings.synonyms;

    if (!rw.enabled && !syn.enabled) {
        return; // Both disabled
    }

    // Skip dry runs (initialization, previews, token counting, etc.)
    if (!eventData || eventData.dryRun) {
        console.log('🐰 Rabbit Response Team: Skipping injection (dry run)');
        return;
    }

    // Ensure we have valid chat data
    if (!eventData.chat || eventData.chat.length === 0) {
        console.log('🐰 Rabbit Response Team: Skipping injection (no chat data)');
        return;
    }

    // RANDOM WORDS INJECTION
    if (rw.enabled) {
        // Check minimum message length
        const minLength = rw.minMessageLength;
        if (minLength > 0 && eventData.chat.length > 0) {
            const lastMessage = eventData.chat[eventData.chat.length - 1];
            if (lastMessage && lastMessage.content && lastMessage.content.length < minLength) {
                console.log(`🐰 Rabbit Response Team (Random): Skipping injection (message length ${lastMessage.content.length} < ${minLength})`);
            } else {
                await injectRandomWords(eventData, rw);
            }
        } else {
            await injectRandomWords(eventData, rw);
        }
    }

    // SYNONYMS INJECTION
    if (syn.enabled) {
        await injectSynonyms(eventData, syn);
    }
});

// Inject random words
async function injectRandomWords(eventData, settings) {
    const wordCount = settings.wordCount;

    // Generate NEW words for every generation
    const randomWords = await getRandomWords(wordCount);

    if (randomWords.length === 0) {
        console.warn('🐰 Rabbit Response Team (Random): No words selected!');
        return;
    }

    // Extract word strings for logging and display
    const wordStrings = randomWords.map(w => typeof w === 'object' ? w.word : w);
    console.log('🐰 Rabbit Response Team (Random): Generated new words:', wordStrings);

    // Create the instruction using custom prompt template
    let wordListFormatted;
    if (settings.includeDefinitions && typeof randomWords[0] === 'object') {
        // Format with definitions: "word (definition)"
        wordListFormatted = randomWords.map(item => {
            if (item.definition) {
                return `"${item.word}" (${item.definition})`;
            }
            return `"${item.word}"`;
        }).join(', ');
    } else {
        // Format without definitions: just words
        wordListFormatted = wordStrings.map(w => `"${w}"`).join(', ');
    }

    const promptTemplate = settings.customPrompt || DEFAULT_RANDOM_PROMPT;
    const injectionText = promptTemplate.replace('{{words}}', wordListFormatted);

    console.log('🐰 Rabbit Response Team (Random): Injecting words (ephemeral):', wordStrings);
    console.log('🐰 Rabbit Response Team (Random): Using role:', settings.injectionEndRole);
    console.log('🐰 Rabbit Response Team (Random): Injection depth:', settings.injectionDepth);

    // Inject into prompt
    if (eventData && eventData.chat) {
        const depth = Number.isFinite(settings.injectionDepth) ? Math.max(0, settings.injectionDepth) : 0;
        const lastMessage = eventData.chat[eventData.chat.length - 1];
        const avoidTrailingAssistant = lastMessage && lastMessage.role === 'assistant' && settings.injectionEndRole !== 'assistant';
        const effectiveDepth = depth + (avoidTrailingAssistant ? 1 : 0);
        const targetIndex = eventData.chat.length - effectiveDepth;
        const insertIndex = Math.max(0, Math.min(targetIndex, eventData.chat.length));

        eventData.chat.splice(insertIndex, 0, {
            role: settings.injectionEndRole,
            content: injectionText
        });

        console.log(`🐰 Rabbit Response Team (Random): ✅ Injected at position ${insertIndex}`);

        // Update header with last words (just the word strings, not definitions)
        updateHeaderWithWords(wordStrings);
    }
}

// Inject synonyms for frequently used words
async function injectSynonyms(eventData, settings) {
    try {
        const context = SillyTavern.getContext();
        const chat = context.chat;

        if (!chat || chat.length < settings.scanDepth) {
            console.log('🐰 Rabbit Response Team (Synonyms): Not enough messages to scan');
            return;
        }

        // Get last N messages
        const messagesToScan = chat.slice(-settings.scanDepth);
        const wordFrequency = {};
        const properNouns = new Set(); // Track likely proper nouns to exclude

        // Build combined exclusion set (default stopwords + user exclusions)
        const exclusionSet = new Set(DEFAULT_STOPWORDS);
        if (settings.excludeWords && settings.excludeWords.trim()) {
            const userExclusions = settings.excludeWords
                .toLowerCase()
                .split(',')
                .map(w => w.trim())
                .filter(w => w);
            userExclusions.forEach(word => exclusionSet.add(word));
        }

        // Count word frequency
        messagesToScan.forEach((msg, idx) => {
            // Filter by scan source
            const isUser = msg.is_user;
            const isAI = !msg.is_user;

            if (settings.scanSource === 'user' && !isUser) return;
            if (settings.scanSource === 'ai' && !isAI) return;

            // Extract words from message with proper noun detection
            const text = msg.mes || msg.content || '';

            // Split into sentences to detect sentence starts
            // Match sentence endings: period, exclamation, question mark (with optional quotes/parentheses)
            const sentences = text.split(/[.!?]+["')]?\s+|^/);

            sentences.forEach(sentence => {
                if (!sentence || sentence.trim().length === 0) return;

                // Get words with their original capitalization
                const wordsWithCase = sentence.match(/\b[a-zA-Z]+\b/g) || [];

                wordsWithCase.forEach((originalWord, wordIndex) => {
                    const lowerWord = originalWord.toLowerCase();

                    // Skip if too short
                    if (lowerWord.length < 4) return;

                    // Detect proper nouns: capitalized words that are NOT the first word in a sentence
                    const isFirstWordInSentence = wordIndex === 0;
                    const isCapitalized = /^[A-Z]/.test(originalWord);

                    if (isCapitalized && !isFirstWordInSentence) {
                        // This is likely a proper noun (name, place, etc.)
                        properNouns.add(lowerWord);
                        return; // Don't count proper nouns
                    }

                    // Filter by stopwords and proper nouns
                    if (!exclusionSet.has(lowerWord) && !properNouns.has(lowerWord)) {
                        wordFrequency[lowerWord] = (wordFrequency[lowerWord] || 0) + 1;
                    }
                });
            });
        });

        if (properNouns.size > 0) {
            console.log(`🐰 Rabbit Response Team (Synonyms): Excluded ${properNouns.size} proper nouns:`, Array.from(properNouns).join(', '));
        }

        // Find words that exceed minimum occurrences
        const overusedWords = Object.entries(wordFrequency)
            .filter(([word, count]) => count >= settings.minOccurrences)
            .sort((a, b) => b[1] - a[1]); // Sort by frequency descending

        if (overusedWords.length === 0) {
            console.log('🐰 Rabbit Response Team (Synonyms): No overused words found');
            return;
        }

        // Pick the most overused word
        const [targetWord, frequency] = overusedWords[0];
        console.log(`🐰 Rabbit Response Team (Synonyms): Found overused word "${targetWord}" (used ${frequency} times)`);

        // Fetch synonyms from Datamuse
        const synonyms = await fetchSynonyms(targetWord, settings.synonymCount);

        if (!synonyms || synonyms.length === 0) {
            console.warn(`🐰 Rabbit Response Team (Synonyms): No synonyms found for "${targetWord}"`);
            return;
        }

        // Create injection message
        const synonymList = synonyms.map(w => `"${w}"`).join(', ');
        const promptTemplate = settings.customPrompt || DEFAULT_SYNONYM_PROMPT;
        const injectionText = promptTemplate
            .replace('{{originalWord}}', targetWord)
            .replace('{{synonyms}}', synonymList);

        console.log('🐰 Rabbit Response Team (Synonyms): Injecting synonyms:', synonyms);

        // Inject into prompt
        if (eventData && eventData.chat) {
            const depth = Number.isFinite(settings.injectionDepth) ? Math.max(0, settings.injectionDepth) : 0;
            const lastMessage = eventData.chat[eventData.chat.length - 1];
            const avoidTrailingAssistant = lastMessage && lastMessage.role === 'assistant' && settings.injectionEndRole !== 'assistant';
            const effectiveDepth = depth + (avoidTrailingAssistant ? 1 : 0);
            const targetIndex = eventData.chat.length - effectiveDepth;
            const insertIndex = Math.max(0, Math.min(targetIndex, eventData.chat.length));

            eventData.chat.splice(insertIndex, 0, {
                role: settings.injectionEndRole,
                content: injectionText
            });

            console.log(`🐰 Rabbit Response Team (Synonyms): ✅ Injected at position ${insertIndex}`);
        }
    } catch (error) {
        console.error('🐰 Rabbit Response Team (Synonyms): Error:', error);
    }
}

// Fetch synonyms for a word using Datamuse
async function fetchSynonyms(word, count) {
    const url = 'https://api.datamuse.com/words';
    const params = new URLSearchParams();

    params.append('rel_syn', word); // Synonyms
    params.append('max', Math.max(count * 3, 15)); // Fetch extra for filtering

    const fullUrl = url + '?' + params.toString();

    try {
        console.log(`🐰 Rabbit Response Team: Fetching synonyms from ${fullUrl}`);
        const response = await fetch(fullUrl);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const words = await response.json();

        if (Array.isArray(words)) {
            // Extract word strings and shuffle
            const synonyms = words
                .map(item => item.word)
                .sort(() => Math.random() - 0.5)
                .slice(0, count);

            return synonyms;
        }

        return [];
    } catch (error) {
        console.error('🐰 Rabbit Response Team: Synonym fetch failed:', error);
        return [];
    }
}

// Update header to show last injected words
function updateHeaderWithWords(words) {
    const settings = extension_settings[extensionName];
    if (!settings || !settings.randomWords || !settings.randomWords.showLastWords) return;

    const headerTitle = $('.rabbit-header-title');
    if (headerTitle.length && words && words.length > 0) {
        const wordsDisplay = words.map(w => `"${w}"`).join(', ');
        headerTitle.text(`Rabbit Response Team - ${wordsDisplay}`);
        console.log('🐰 Rabbit Response Team: Updated header with words:', wordsDisplay);
    }
}

// Create settings UI
// Create settings UI
function createSettingsUI() {
    const settingsHtml = `
        <div class="rabbit-numeral-container">
            <div class="rabbit-header" data-toggle="collapse" data-target="#rabbit-settings-body" aria-expanded="true">
                <div class="rabbit-header-icon">🐰</div>
                <h3 class="rabbit-header-title">Rabbit Response Team</h3>
                <div class="rabbit-header-toggle">
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
            </div>
            <div id="rabbit-settings-body" class="rabbit-settings-body" data-api-provider="vercel" data-datamuse-mode="random">
                <p class="rabbit-description">
                    Two powerful features: inject random words OR provide synonyms for overused words
                </p>

                <!-- Tab Switcher -->
                <div class="rabbit-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid rgba(147, 51, 234, 0.3);">
                    <button class="rabbit-tab-button active" data-tab="random" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #9333ea 0%, #4f46e5 100%); color: white; border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600;">
                        Random Words
                    </button>
                    <button class="rabbit-tab-button" data-tab="synonyms" style="flex: 1; padding: 12px; background: var(--black50a); color: var(--SmartThemeBodyColor); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600;">
                        Synonyms
                    </button>
                </div>

                <!-- RANDOM WORDS TAB -->
                <div id="rabbit-tab-random" class="rabbit-tab-content">
                    <div class="rabbit-setting-row">
                        <label for="rabbit_random_enabled" style="display: flex; align-items: center; justify-content: space-between;">
                            <span>Enable Random Words</span>
                            <label class="rabbit-toggle-switch">
                                <input type="checkbox" id="rabbit_random_enabled" name="rabbit_random_enabled" />
                                <span class="rabbit-toggle-slider"></span>
                            </label>
                        </label>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_word_count">
                            Number of Random Words: <span id="rabbit_word_count_value">3</span>
                        </label>
                        <input type="range" id="rabbit_word_count" name="rabbit_word_count"
                               min="1" max="10" value="3" step="1" style="width: 100%;" />
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_use_api">
                            <input type="checkbox" id="rabbit_use_api" name="rabbit_use_api" checked />
                            Use Random Word API (requires internet)
                        </label>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Fetches real random words from an online dictionary
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_api_provider">API Provider:</label>
                        <select id="rabbit_api_provider" name="rabbit_api_provider" style="width: 100%; padding: 5px;">
                            <option value="vercel">Vercel (Advanced Filters)</option>
                            <option value="heroku">Heroku (Multi-language)</option>
                            <option value="datamuse">Datamuse (Part of Speech)</option>
                        </select>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Each API has unique filtering options
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_word_length">
                            Word Length: <span id="rabbit_word_length_value">Any</span>
                        </label>
                        <input type="range" id="rabbit_word_length" name="rabbit_word_length"
                               min="0" max="12" value="0" step="1" style="width: 100%;" />
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            0 = Any length, 1-12 = Specific letter count
                        </small>
                    </div>

                    <!-- Heroku-specific -->
                    <div class="rabbit-setting-row rabbit-heroku-only">
                        <label for="rabbit_language">Language:</label>
                        <select id="rabbit_language" name="rabbit_language" style="width: 100%; padding: 5px;">
                            <option value="en">🇬🇧 English</option>
                            <option value="es">🇪🇸 Spanish</option>
                            <option value="it">🇮🇹 Italian</option>
                            <option value="de">🇩🇪 German</option>
                            <option value="fr">🇫🇷 French</option>
                            <option value="zh">🇨🇳 Chinese</option>
                            <option value="pt-br">🇧🇷 Portuguese (Brazil)</option>
                        </select>
                    </div>

                    <!-- Vercel-specific -->
                    <div class="rabbit-setting-row rabbit-vercel-only">
                        <label for="rabbit_vercel_first_letter">First Letter (optional):</label>
                        <select id="rabbit_vercel_first_letter" name="rabbit_vercel_first_letter" style="width: 100%; padding: 5px;">
                            <option value="">Any letter</option>
                            <option value="a">A</option><option value="b">B</option><option value="c">C</option>
                            <option value="d">D</option><option value="e">E</option><option value="f">F</option>
                            <option value="g">G</option><option value="h">H</option><option value="i">I</option>
                            <option value="j">J</option><option value="k">K</option><option value="l">L</option>
                            <option value="m">M</option><option value="n">N</option><option value="o">O</option>
                            <option value="p">P</option><option value="q">Q</option><option value="r">R</option>
                            <option value="s">S</option><option value="t">T</option><option value="u">U</option>
                            <option value="v">V</option><option value="w">W</option><option value="x">X</option>
                            <option value="y">Y</option><option value="z">Z</option>
                        </select>
                    </div>

                    <div class="rabbit-setting-row rabbit-vercel-only">
                        <label for="rabbit_alphabetize">
                            <input type="checkbox" id="rabbit_alphabetize" name="rabbit_alphabetize" />
                            Alphabetize results
                        </label>
                    </div>

                    <!-- Datamuse-specific -->
                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_datamuse_mode">Word Selection Mode:</label>
                        <select id="rabbit_datamuse_mode" name="rabbit_datamuse_mode" style="width: 100%; padding: 5px;">
                            <option value="random">True Random</option>
                            <option value="contextual">Contextual (from your message)</option>
                        </select>
                        <small id="rabbit_datamuse_mode_desc" style="opacity: 0.7; display: block; margin-top: 5px;">
                            Random: completely random words | Contextual: words related to your last message
                        </small>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only rabbit-datamuse-contextual">
                        <label for="rabbit_relationship_type">Relationship Type:</label>
                        <select id="rabbit_relationship_type" name="rabbit_relationship_type" style="width: 100%; padding: 5px;">
                            <option value="trg">Triggers (statistically associated)</option>
                            <option value="syn">Synonyms (similar meaning)</option>
                            <option value="jja">Adjectives (describe the word)</option>
                            <option value="jjb">Described by (nouns modified by adjective)</option>
                            <option value="ant">Antonyms (opposite meaning)</option>
                        </select>
                        <small id="rabbit_relationship_desc" style="opacity: 0.7; display: block; margin-top: 5px;">
                            Words statistically associated with the picked word from your message
                        </small>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_double_pass">
                            <input type="checkbox" id="rabbit_double_pass" name="rabbit_double_pass" />
                            Double Pass Mode
                        </label>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Pick 1 word using selected mode, then find related words to theme around it
                        </small>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_datamuse_first_letter">First Letter (optional):</label>
                        <select id="rabbit_datamuse_first_letter" name="rabbit_datamuse_first_letter" style="width: 100%; padding: 5px;">
                            <option value="">Any letter</option>
                            <option value="a">A</option><option value="b">B</option><option value="c">C</option>
                            <option value="d">D</option><option value="e">E</option><option value="f">F</option>
                            <option value="g">G</option><option value="h">H</option><option value="i">I</option>
                            <option value="j">J</option><option value="k">K</option><option value="l">L</option>
                            <option value="m">M</option><option value="n">N</option><option value="o">O</option>
                            <option value="p">P</option><option value="q">Q</option><option value="r">R</option>
                            <option value="s">S</option><option value="t">T</option><option value="u">U</option>
                            <option value="v">V</option><option value="w">W</option><option value="x">X</option>
                            <option value="y">Y</option><option value="z">Z</option>
                        </select>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_word_commonness">
                            Word Commonness: <span id="rabbit_word_commonness_value">50</span>
                        </label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span style="font-size: 11px; opacity: 0.7;">Rare</span>
                            <input type="range" id="rabbit_word_commonness" name="rabbit_word_commonness"
                                   min="0" max="100" value="50" step="5" style="flex: 1;" />
                            <span style="font-size: 11px; opacity: 0.7;">Common</span>
                        </div>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            0 = Rare words only, 50 = Mix of both, 100 = Common words only
                        </small>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_include_definitions">
                            <input type="checkbox" id="rabbit_include_definitions" name="rabbit_include_definitions" />
                            Include Definitions
                        </label>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Add word definitions to the prompt (from Wiktionary/WordNet)
                        </small>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label>Part of Speech:</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 8px;">
                            <label for="rabbit_pos_noun" style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="rabbit_pos_noun" name="rabbit_pos_noun" checked />
                                Nouns
                            </label>
                            <label for="rabbit_pos_verb" style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="rabbit_pos_verb" name="rabbit_pos_verb" checked />
                                Verbs
                            </label>
                            <label for="rabbit_pos_adj" style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="rabbit_pos_adj" name="rabbit_pos_adj" checked />
                                Adjectives
                            </label>
                            <label for="rabbit_pos_adv" style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="rabbit_pos_adv" name="rabbit_pos_adv" />
                                Adverbs
                            </label>
                        </div>
                    </div>

                    <div class="rabbit-setting-row rabbit-datamuse-only">
                        <label for="rabbit_theme_words">Theme Words (optional):</label>
                        <input type="text" id="rabbit_theme_words" name="rabbit_theme_words"
                               placeholder="e.g., ocean, adventure, mystery"
                               style="width: 100%; padding: 8px; border-radius: 6px;
                                      background: var(--black30a); color: var(--SmartThemeBodyColor);
                                      border: 1px solid rgba(147, 51, 234, 0.3);" />
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Up to 5 comma-separated theme words (nouns work best)
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_fallback">
                            <input type="checkbox" id="rabbit_fallback" name="rabbit_fallback" checked />
                            Use Fallback Word Bank (if API unavailable)
                        </label>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Uses a curated bank of 113 real words when internet/API is down
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <button id="rabbit_test" class="rabbit-test-button">🎲 Test Random Words</button>
                    </div>

                    <!-- Advanced Settings -->
                    <div class="rabbit-advanced-header" data-toggle="collapse" data-target="#rabbit-random-advanced-body" aria-expanded="false">
                        <i class="fa-solid fa-cog"></i>
                        <span>Advanced Settings</span>
                        <i class="fa-solid fa-chevron-down rabbit-advanced-toggle"></i>
                    </div>

                    <div id="rabbit-random-advanced-body" class="rabbit-advanced-body" style="display: none;">
                        <div class="rabbit-setting-row">
                            <label for="rabbit_custom_prompt">Custom Prompt Template:</label>
                            <textarea id="rabbit_custom_prompt" name="rabbit_custom_prompt" rows="4"
                                      style="width: 100%; padding: 8px; border-radius: 6px;
                                             background: var(--black30a); color: var(--SmartThemeBodyColor);
                                             border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                Use <code>{{words}}</code> macro to insert the random words
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_injection_depth">Injection Depth:</label>
                            <input type="number" id="rabbit_injection_depth" name="rabbit_injection_depth"
                                   min="0" max="50" value="0"
                                   style="width: 100%; padding: 8px; border-radius: 6px;
                                          background: var(--black30a); color: var(--SmartThemeBodyColor);
                                          border: 1px solid rgba(147, 51, 234, 0.3);" />
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                0 = just before assistant prefill, higher = further up
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_injection_end_role">Injection Role:</label>
                            <select id="rabbit_injection_end_role" name="rabbit_injection_end_role" style="width: 100%; padding: 8px;">
                                <option value="system">System</option>
                                <option value="user">User</option>
                                <option value="assistant">Assistant</option>
                            </select>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_word_blacklist">Word Blacklist:</label>
                            <textarea id="rabbit_word_blacklist" name="rabbit_word_blacklist" rows="2"
                                      placeholder="e.g., inappropriate, complex, difficult"
                                      style="width: 100%; padding: 8px; border-radius: 6px;
                                             background: var(--black30a); color: var(--SmartThemeBodyColor);
                                             border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                Comma-separated list of words to never inject (case-insensitive)
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_history_size">Word History Size:</label>
                            <input type="number" id="rabbit_history_size" name="rabbit_history_size"
                                   min="0" max="100" value="20"
                                   style="width: 100%; padding: 8px; border-radius: 6px;
                                          background: var(--black30a); color: var(--SmartThemeBodyColor);
                                          border: 1px solid rgba(147, 51, 234, 0.3);" />
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                Track recently used words to avoid repeats (0 = disabled)
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_min_message_length">Minimum Message Length:</label>
                            <input type="number" id="rabbit_min_message_length" name="rabbit_min_message_length"
                                   min="0" max="1000" value="0"
                                   style="width: 100%; padding: 8px; border-radius: 6px;
                                          background: var(--black30a); color: var(--SmartThemeBodyColor);
                                          border: 1px solid rgba(147, 51, 234, 0.3);" />
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                Only inject if user message is at least this many characters (0 = always inject)
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_show_last_words">
                                <input type="checkbox" id="rabbit_show_last_words" name="rabbit_show_last_words" checked />
                                Show Last Words in Header
                            </label>
                        </div>

                        <div class="rabbit-setting-row">
                            <button id="rabbit_reset_prompt" class="rabbit-reset-button">
                                <i class="fa-solid fa-rotate-left"></i> Reset to Default Template
                            </button>
                        </div>
                    </div>
                </div>

                <!-- SYNONYMS TAB -->
                <div id="rabbit-tab-synonyms" class="rabbit-tab-content" style="display: none;">
                    <div class="rabbit-setting-row">
                        <label for="rabbit_synonym_enabled" style="display: flex; align-items: center; justify-content: space-between;">
                            <span>Enable Synonyms</span>
                            <label class="rabbit-toggle-switch">
                                <input type="checkbox" id="rabbit_synonym_enabled" name="rabbit_synonym_enabled" />
                                <span class="rabbit-toggle-slider"></span>
                            </label>
                        </label>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Detect overused words and suggest synonyms for variety
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_scan_depth">Scan Depth (messages):</label>
                        <input type="number" id="rabbit_scan_depth" name="rabbit_scan_depth"
                               min="1" max="20" value="3"
                               style="width: 100%; padding: 8px; border-radius: 6px;
                                      background: var(--black30a); color: var(--SmartThemeBodyColor);
                                      border: 1px solid rgba(147, 51, 234, 0.3);" />
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            How many recent messages to analyze for word frequency
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_min_occurrences">Minimum Occurrences:</label>
                        <input type="number" id="rabbit_min_occurrences" name="rabbit_min_occurrences"
                               min="2" max="10" value="2"
                               style="width: 100%; padding: 8px; border-radius: 6px;
                                      background: var(--black30a); color: var(--SmartThemeBodyColor);
                                      border: 1px solid rgba(147, 51, 234, 0.3);" />
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Word must appear this many times to trigger synonym suggestion
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_scan_source">Scan Source:</label>
                        <select id="rabbit_scan_source" name="rabbit_scan_source" style="width: 100%; padding: 8px;">
                            <option value="both">Both (AI + User)</option>
                            <option value="ai">AI Only</option>
                            <option value="user">User Only</option>
                        </select>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Which messages to scan for word frequency
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_synonym_count">Number of Synonyms:</label>
                        <input type="number" id="rabbit_synonym_count" name="rabbit_synonym_count"
                               min="1" max="10" value="3"
                               style="width: 100%; padding: 8px; border-radius: 6px;
                                      background: var(--black30a); color: var(--SmartThemeBodyColor);
                                      border: 1px solid rgba(147, 51, 234, 0.3);" />
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            How many synonym alternatives to provide
                        </small>
                    </div>

                    <div class="rabbit-setting-row">
                        <label for="rabbit_exclude_words">Exclude Words (optional):</label>
                        <textarea id="rabbit_exclude_words" name="rabbit_exclude_words" rows="3"
                                  placeholder="e.g., character_name, location_name, special_term"
                                  style="width: 100%; padding: 8px; border-radius: 6px;
                                         background: var(--black30a); color: var(--SmartThemeBodyColor);
                                         border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                        <small style="opacity: 0.7; display: block; margin-top: 5px;">
                            Comma-separated list of words to never detect (in addition to built-in stopwords like "the", "and", "that", "this", "have", "been", "with", etc.)
                        </small>
                    </div>

                    <!-- Advanced Settings -->
                    <div class="rabbit-advanced-header" data-toggle="collapse" data-target="#rabbit-synonym-advanced-body" aria-expanded="false">
                        <i class="fa-solid fa-cog"></i>
                        <span>Advanced Settings</span>
                        <i class="fa-solid fa-chevron-down rabbit-advanced-toggle"></i>
                    </div>

                    <div id="rabbit-synonym-advanced-body" class="rabbit-advanced-body" style="display: none;">
                        <div class="rabbit-setting-row">
                            <label for="rabbit_synonym_prompt">Custom Prompt Template:</label>
                            <textarea id="rabbit_synonym_prompt" name="rabbit_synonym_prompt" rows="4"
                                      style="width: 100%; padding: 8px; border-radius: 6px;
                                             background: var(--black30a); color: var(--SmartThemeBodyColor);
                                             border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                            <small style="opacity: 0.7; display: block; margin-top: 5px;">
                                Use <code>{{originalWord}}</code> and <code>{{synonyms}}</code> macros
                            </small>
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_synonym_injection_depth">Injection Depth:</label>
                            <input type="number" id="rabbit_synonym_injection_depth" name="rabbit_synonym_injection_depth"
                                   min="0" max="50" value="0"
                                   style="width: 100%; padding: 8px; border-radius: 6px;
                                          background: var(--black30a); color: var(--SmartThemeBodyColor);
                                          border: 1px solid rgba(147, 51, 234, 0.3);" />
                        </div>

                        <div class="rabbit-setting-row">
                            <label for="rabbit_synonym_injection_end_role">Injection Role:</label>
                            <select id="rabbit_synonym_injection_end_role" name="rabbit_synonym_injection_end_role" style="width: 100%; padding: 8px;">
                                <option value="system">System</option>
                                <option value="user">User</option>
                                <option value="assistant">Assistant</option>
                            </select>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    $('#extensions_settings2').append(settingsHtml);

    // Tab switching
    $('.rabbit-tab-button').on('click', function() {
        const tab = $(this).data('tab');
        $('.rabbit-tab-button').removeClass('active')
            .css('background', 'var(--black50a)')
            .css('color', 'var(--SmartThemeBodyColor)');
        $(this).addClass('active')
            .css('background', 'linear-gradient(135deg, #9333ea 0%, #4f46e5 100%)')
            .css('color', 'white');

        $('.rabbit-tab-content').hide();
        $(`#rabbit-tab-${tab}`).show();
    });

    // Main header collapse toggle
    $('.rabbit-header').on('click', function() {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        $('#rabbit-settings-body').slideToggle(300);
    });

    // Advanced section toggles
    $('.rabbit-advanced-header').on('click', function() {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        const target = $(this).data('target');
        $(target).slideToggle(300);
    });

    // Random Words tab event listeners
    $('#rabbit_random_enabled').on('change', saveSettings);

    $('#rabbit_word_count').on('input', function() {
        $('#rabbit_word_count_value').text($(this).val());
        saveSettings();
    });

    $('#rabbit_word_length').on('input', function() {
        const val = parseInt($(this).val());
        $('#rabbit_word_length_value').text(val === 0 ? 'Any' : val);
        saveSettings();
    });

    $('#rabbit_use_api').on('change', saveSettings);

    $('#rabbit_api_provider').on('change', function() {
        updateAPIOptions();
        saveSettings();
    });

    $('#rabbit_fallback').on('change', saveSettings);
    $('#rabbit_language').on('change', saveSettings);
    $('#rabbit_vercel_first_letter').on('change', saveSettings);
    $('#rabbit_alphabetize').on('change', saveSettings);

    // Datamuse-specific listeners
    $('#rabbit_pos_noun').on('change', saveSettings);
    $('#rabbit_pos_verb').on('change', saveSettings);
    $('#rabbit_pos_adj').on('change', saveSettings);
    $('#rabbit_pos_adv').on('change', saveSettings);

    $('#rabbit_datamuse_mode').on('change', function() {
        updateDatamuseMode();
        saveSettings();
    });

    // Dynamic relationship descriptions
    $('#rabbit_relationship_type').on('change', function() {
        updateRelationshipDescription();
        saveSettings();
    });

    $('#rabbit_double_pass').on('change', saveSettings);
    $('#rabbit_datamuse_first_letter').on('change', saveSettings);

    $('#rabbit_word_commonness').on('input', function() {
        $('#rabbit_word_commonness_value').text($(this).val());
        saveSettings();
    });

    $('#rabbit_include_definitions').on('change', saveSettings);

    $('#rabbit_theme_words').on('input', saveSettings);

    // Test button
    $('#rabbit_test').on('click', async function() {
        const count = parseInt($('#rabbit_word_count').val());
        const provider = $('#rabbit_api_provider').val();

        toastr.info(`Fetching ${count} random words from ${provider}...`, 'Rabbit Response Team');

        const words = await getRandomWords(count);

        if (words.length > 0) {
            // Extract word strings and optionally definitions
            const settings = extension_settings[extensionName].randomWords;
            let displayText;

            if (settings.includeDefinitions && typeof words[0] === 'object') {
                displayText = words.map(item => {
                    if (item.definition) {
                        return `${item.word} (${item.definition})`;
                    }
                    return item.word;
                }).join(', ');
            } else {
                const wordStrings = words.map(w => typeof w === 'object' ? w.word : w);
                displayText = wordStrings.join(', ');
            }

            toastr.success(`Random words: ${displayText}`, 'Rabbit Response Team', { timeOut: 10000 });
        } else {
            toastr.error('Failed to get random words!', 'Rabbit Response Team');
        }
    });

    // Advanced settings listeners
    $('#rabbit_custom_prompt').on('input', saveSettings);
    $('#rabbit_injection_depth').on('input', saveSettings);
    $('#rabbit_injection_end_role').on('change', saveSettings);
    $('#rabbit_word_blacklist').on('input', saveSettings);
    $('#rabbit_history_size').on('input', saveSettings);
    $('#rabbit_min_message_length').on('input', saveSettings);
    $('#rabbit_show_last_words').on('change', saveSettings);

    $('#rabbit_reset_prompt').on('click', function() {
        $('#rabbit_custom_prompt').val(DEFAULT_RANDOM_PROMPT);
        saveSettings();
        toastr.success('Prompt template reset to default', 'Rabbit Response Team');
    });

    // Synonyms tab event listeners
    $('#rabbit_synonym_enabled').on('change', saveSettings);
    $('#rabbit_scan_depth').on('input', saveSettings);
    $('#rabbit_min_occurrences').on('input', saveSettings);
    $('#rabbit_scan_source').on('change', saveSettings);
    $('#rabbit_synonym_count').on('input', saveSettings);
    $('#rabbit_exclude_words').on('input', saveSettings);
    $('#rabbit_synonym_prompt').on('input', saveSettings);
    $('#rabbit_synonym_injection_depth').on('input', saveSettings);
    $('#rabbit_synonym_injection_end_role').on('change', saveSettings);

    // Initialize visibility
    updateAPIOptions();
    updateDatamuseMode();
    updateRelationshipDescription();

    console.log('🐰 Rabbit Response Team: Settings UI created');
}

// Update relationship type description dynamically
function updateRelationshipDescription() {
    const relType = $('#rabbit_relationship_type').val();
    const descriptions = {
        'trg': 'Words statistically associated with the picked word from your message',
        'syn': 'Words with similar meaning to the picked word',
        'jja': 'Adjectives that typically describe the picked word',
        'jjb': 'Nouns that the picked adjective typically describes',
        'ant': 'Words with opposite meaning to the picked word'
    };
    $('#rabbit_relationship_desc').text(descriptions[relType] || '');
}

// Initialize extension
jQuery(async () => {
    // Create UI
    createSettingsUI();

    // Load settings
    loadSettings();

    console.log('🐰 Rabbit Response Team: Extension initialized');
});
