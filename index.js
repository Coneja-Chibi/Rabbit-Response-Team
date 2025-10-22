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
    }
};

// Default prompt template
const DEFAULT_PROMPT_TEMPLATE = `[OOC NARRATIVE OVERDRIVE: You must naturally incorporate the following words into your response: {{words}}. Use each word at least once, weaving them seamlessly into the narrative flow. DO NOT bold, italicize, or add any visual indicators around these words - they must appear as normal text, indistinguishable from the rest of your writing.]`;

// Default settings
const defaultSettings = {
    enabled: false,
    wordCount: 3,
    useAPI: true,
    apiProvider: 'vercel', // 'heroku' or 'vercel'
    fallbackToGenerated: true,

    // Prompt customization
    customPrompt: DEFAULT_PROMPT_TEMPLATE,
    injectionDepth: 0, // 0 = just before trailing assistant/prefill, higher = further up
    injectionEndRole: 'system', // system, user, or assistant (matches Guided Generations naming)

    // Shared settings
    wordLength: 0, // 0 = any length

    // Heroku-specific
    language: 'en', // en, es, it, de, fr, zh, pt-br

    // Vercel-specific
    firstLetter: '', // a-z or empty
    alphabetize: false,

    // Advanced features
    wordBlacklist: '', // Comma-separated list of words to never use
    historySize: 20, // How many recent words to track (0 = disabled)
    minMessageLength: 0, // Minimum user message length to trigger injection (0 = always inject)
    showLastWords: true // Show last injected words in the header
};

// Word history tracking (stored in memory, not saved)
let wordHistory = [];

// Load settings
function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }

    // Merge any missing default settings (for users upgrading from older versions)
    const settings = extension_settings[extensionName];
    let needsSave = false;
    for (const key in defaultSettings) {
        if (settings[key] === undefined) {
            settings[key] = defaultSettings[key];
            needsSave = true;
            console.log(`🐰 Rabbit Response Team: Added missing setting '${key}' with default value`);
        }
    }

    // Save merged settings
    if (needsSave) {
        saveSettingsDebounced();
    }

    // Update UI if it exists
    $('#rabbit_enabled').prop('checked', settings.enabled);
    $('#rabbit_word_count').val(settings.wordCount);
    $('#rabbit_word_count_value').text(settings.wordCount);
    $('#rabbit_use_api').prop('checked', settings.useAPI);

    // Set API provider
    $('#rabbit_api_provider').val(settings.apiProvider);

    $('#rabbit_fallback').prop('checked', settings.fallbackToGenerated);

    // Prompt customization (with existence checks)
    const customPromptElem = $('#rabbit_custom_prompt');
    const injectionDepthElem = $('#rabbit_injection_depth');
    const injectionEndRoleElem = $('#rabbit_injection_end_role');

    if (customPromptElem.length) {
        customPromptElem.val(settings.customPrompt || DEFAULT_PROMPT_TEMPLATE);
    }
    if (injectionDepthElem.length) {
        injectionDepthElem.val(settings.injectionDepth ?? 0);
    }
    if (injectionEndRoleElem.length) {
        injectionEndRoleElem.val(settings.injectionEndRole || 'system');
    }

    // Advanced features
    $('#rabbit_word_blacklist').val(settings.wordBlacklist || '');
    $('#rabbit_history_size').val(settings.historySize ?? 20);
    $('#rabbit_min_message_length').val(settings.minMessageLength ?? 0);
    $('#rabbit_show_last_words').prop('checked', settings.showLastWords ?? true);

    // Shared settings
    $('#rabbit_word_length').val(settings.wordLength);
    $('#rabbit_word_length_value').text(settings.wordLength === 0 ? 'Any' : settings.wordLength);

    // Heroku-specific
    $('#rabbit_language').val(settings.language);

    // Vercel-specific
    $('#rabbit_first_letter').val(settings.firstLetter);
    $('#rabbit_alphabetize').prop('checked', settings.alphabetize);

    // Show/hide API-specific options
    updateAPIOptions();

    console.log('🐰 Rabbit Response Team: Settings loaded', settings);
}

// Save settings
function saveSettings() {
    const settings = extension_settings[extensionName];

    settings.enabled = $('#rabbit_enabled').prop('checked');
    settings.wordCount = parseInt($('#rabbit_word_count').val());
    settings.useAPI = $('#rabbit_use_api').prop('checked');
    settings.apiProvider = $('#rabbit_api_provider').val();
    settings.fallbackToGenerated = $('#rabbit_fallback').prop('checked');

    // Prompt customization
    settings.customPrompt = $('#rabbit_custom_prompt').val();
    settings.injectionDepth = parseInt($('#rabbit_injection_depth').val());
    settings.injectionEndRole = $('#rabbit_injection_end_role').val();

    // Advanced features
    settings.wordBlacklist = $('#rabbit_word_blacklist').val();
    settings.historySize = parseInt($('#rabbit_history_size').val()) || 0;
    settings.minMessageLength = parseInt($('#rabbit_min_message_length').val()) || 0;
    settings.showLastWords = $('#rabbit_show_last_words').prop('checked');

    // Shared settings
    settings.wordLength = parseInt($('#rabbit_word_length').val());

    // Heroku-specific
    settings.language = $('#rabbit_language').val();

    // Vercel-specific
    settings.firstLetter = $('#rabbit_first_letter').val();
    settings.alphabetize = $('#rabbit_alphabetize').prop('checked');

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

// Get random words from fallback bank
function getRandomFallbackWords(count) {
    const shuffled = [...FALLBACK_WORD_BANK].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Fetch random words from API
async function fetchRandomWordsFromAPI(count) {
    const settings = extension_settings[extensionName];
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

        if (settings.firstLetter) {
            params.append('letter', settings.firstLetter.toLowerCase());
        }

        if (settings.alphabetize) {
            params.append('alphabetize', 'true');
        }
    }

    url += '?' + params.toString();

    try {
        console.log('🐰 Rabbit Response Team: Fetching from', url);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const words = await response.json();
        console.log('🐰 Rabbit Response Team: Fetched from API:', words);

        return Array.isArray(words) ? words : [words];
    } catch (error) {
        console.error('🐰 Rabbit Response Team: API fetch failed:', error);
        return null;
    }
}

// Check if a word is blacklisted
function isBlacklisted(word) {
    const blacklist = extension_settings[extensionName].wordBlacklist;
    if (!blacklist || blacklist.trim() === '') return false;

    const blacklistedWords = blacklist.toLowerCase().split(',').map(w => w.trim());
    return blacklistedWords.includes(word.toLowerCase());
}

// Check if a word was recently used
function isRecentlyUsed(word) {
    const historySize = extension_settings[extensionName].historySize;
    if (historySize === 0) return false;

    return wordHistory.some(w => w.toLowerCase() === word.toLowerCase());
}

// Add words to history
function addToHistory(words) {
    const historySize = extension_settings[extensionName].historySize;
    if (historySize === 0) return;

    // Add new words
    wordHistory.push(...words);

    // Trim to max size (keep most recent)
    if (wordHistory.length > historySize) {
        wordHistory = wordHistory.slice(-historySize);
    }

    console.log(`🐰 Rabbit Response Team: History now has ${wordHistory.length} words: [${wordHistory.slice(-5).join(', ')}...]`);
}

// Filter out blacklisted and recently used words
function filterWords(words) {
    return words.filter(word => {
        if (isBlacklisted(word)) {
            console.log(`🐰 Rabbit Response Team: Skipping blacklisted word: "${word}"`);
            return false;
        }
        if (isRecentlyUsed(word)) {
            console.log(`🐰 Rabbit Response Team: Skipping recently used word: "${word}"`);
            return false;
        }
        return true;
    });
}

// Get truly random words
async function getRandomWords(count) {
    const useAPI = extension_settings[extensionName].useAPI;
    const fallback = extension_settings[extensionName].fallbackToGenerated;
    const maxAttempts = 20; // Increased from 10 to handle history better
    let attempts = 0;
    let validWords = [];

    console.log(`🐰 Rabbit Response Team: Getting ${count} words (history size: ${wordHistory.length}/${extension_settings[extensionName].historySize})`);

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

    console.log(`🐰 Rabbit Response Team: Returning ${validWords.length} words: [${validWords.join(', ')}]`);
    return validWords.slice(0, count);
}

// Inject words into prompt - EPHEMERAL, at the VERY BOTTOM
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (eventData) => {
    if (!extension_settings[extensionName].enabled) {
        return;
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

    // Check minimum message length
    const minLength = extension_settings[extensionName].minMessageLength;
    if (minLength > 0 && eventData.chat.length > 0) {
        const lastMessage = eventData.chat[eventData.chat.length - 1];
        if (lastMessage && lastMessage.content && lastMessage.content.length < minLength) {
            console.log(`🐰 Rabbit Response Team: Skipping injection (message length ${lastMessage.content.length} < ${minLength})`);
            return;
        }
    }

    const wordCount = extension_settings[extensionName].wordCount;

    // Generate NEW words for every generation (always random)
    const randomWords = await getRandomWords(wordCount);

    if (randomWords.length === 0) {
        console.warn('🐰 Rabbit Response Team: No words selected!');
        return;
    }

    console.log('🐰 Rabbit Response Team: Generated new words for this generation:', randomWords);

    // Create the instruction using custom prompt template
    const wordListFormatted = randomWords.map(w => `"${w}"`).join(', ');
    const settings = extension_settings[extensionName];

    // Replace {{words}} macro in custom prompt (with fallback if undefined)
    const promptTemplate = settings.customPrompt || DEFAULT_PROMPT_TEMPLATE;
    const injectionText = promptTemplate.replace('{{words}}', wordListFormatted);

    console.log('🐰 Rabbit Response Team: Injecting words (ephemeral):', randomWords);
    console.log('🐰 Rabbit Response Team: Using role:', settings.injectionEndRole);
    console.log('🐰 Rabbit Response Team: Injection depth:', settings.injectionDepth);

    // CORRECT METHOD: Push to data.chat (like NoAss does)
    // This is EPHEMERAL - only exists for this generation, doesn't persist to chat history
    if (eventData && eventData.chat) {
        // Handle injection depth - 0 stays near the bottom but before trailing assistant/prefill
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

        console.log(`🐰 Rabbit Response Team: ✅ Injected ephemeral ${settings.injectionEndRole} message at position ${insertIndex}`);

        // Update header with last words
        updateHeaderWithWords(randomWords);
    }
});

// Update header to show last injected words
function updateHeaderWithWords(words) {
    if (!extension_settings[extensionName].showLastWords) return;

    const headerTitle = $('.rabbit-header-title');
    if (headerTitle.length && words && words.length > 0) {
        const wordsDisplay = words.map(w => `"${w}"`).join(', ');
        headerTitle.text(`Rabbit Response Team - ${wordsDisplay}`);
        console.log('🐰 Rabbit Response Team: Updated header with words:', wordsDisplay);
    }
}

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
            <div id="rabbit-settings-body" class="rabbit-settings-body"  data-api-provider="vercel">
                <p class="rabbit-description">
                    Fetches truly random words and requires the AI to use them in the response.
                </p>

            <div class="rabbit-setting-row">
                <label for="rabbit_enabled" style="display: flex; align-items: center; justify-content: space-between;">
                    <span>Enable Rabbit Response Team</span>
                    <label class="rabbit-toggle-switch">
                        <input type="checkbox" id="rabbit_enabled" name="rabbit_enabled" />
                        <span class="rabbit-toggle-slider"></span>
                    </label>
                </label>
            </div>

            <div class="rabbit-setting-row">
                <label for="rabbit_word_count">
                    Number of Random Words: <span id="rabbit_word_count_value">3</span>
                </label>
                <input type="range" id="rabbit_word_count" name="rabbit_word_count"
                       min="1" max="10" value="3" step="1"
                       style="width: 100%;" />
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
                <label for="rabbit_api_provider">
                    API Provider:
                </label>
                <select id="rabbit_api_provider" name="rabbit_api_provider" style="width: 100%; padding: 5px;">
                    <option value="vercel">Vercel (Advanced Filters)</option>
                    <option value="heroku">Heroku (Multi-language)</option>
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
                       min="0" max="12" value="0" step="1"
                       style="width: 100%;" />
                <small style="opacity: 0.7; display: block; margin-top: 5px;">
                    0 = Any length, 1-12 = Specific letter count
                </small>
            </div>

            <!-- Heroku-specific options -->
            <div class="rabbit-setting-row rabbit-heroku-only">
                <label for="rabbit_language">
                    Language:
                </label>
                <select id="rabbit_language" name="rabbit_language" style="width: 100%; padding: 5px;">
                    <option value="en">🇬🇧 English</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="it">🇮🇹 Italian</option>
                    <option value="de">🇩🇪 German</option>
                    <option value="fr">🇫🇷 French</option>
                    <option value="zh">🇨🇳 Chinese</option>
                    <option value="pt-br">🇧🇷 Portuguese (Brazil)</option>
                </select>
                <small style="opacity: 0.7; display: block; margin-top: 5px;">
                    Inject words from different languages!
                </small>
            </div>

            <!-- Vercel-specific options -->
            <div class="rabbit-setting-row rabbit-vercel-only">
                <label for="rabbit_first_letter">
                    First Letter (optional):
                </label>
                <select id="rabbit_first_letter" name="rabbit_first_letter" style="width: 100%; padding: 5px;">
                    <option value="">Any letter</option>
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                    <option value="e">E</option>
                    <option value="f">F</option>
                    <option value="g">G</option>
                    <option value="h">H</option>
                    <option value="i">I</option>
                    <option value="j">J</option>
                    <option value="k">K</option>
                    <option value="l">L</option>
                    <option value="m">M</option>
                    <option value="n">N</option>
                    <option value="o">O</option>
                    <option value="p">P</option>
                    <option value="q">Q</option>
                    <option value="r">R</option>
                    <option value="s">S</option>
                    <option value="t">T</option>
                    <option value="u">U</option>
                    <option value="v">V</option>
                    <option value="w">W</option>
                    <option value="x">X</option>
                    <option value="y">Y</option>
                    <option value="z">Z</option>
                </select>
                <small style="opacity: 0.7; display: block; margin-top: 5px;">
                    Filter words starting with a specific letter
                </small>
            </div>

            <div class="rabbit-setting-row rabbit-vercel-only">
                <label for="rabbit_alphabetize">
                    <input type="checkbox" id="rabbit_alphabetize" name="rabbit_alphabetize" />
                    Alphabetize results
                </label>
                <small style="opacity: 0.7; display: block; margin-top: 5px;">
                    Sort words A-Z before injection
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

            <!-- Advanced Prompt Customization -->
            <div class="rabbit-advanced-header" data-toggle="collapse" data-target="#rabbit-advanced-body" aria-expanded="false">
                <i class="fa-solid fa-cog"></i>
                <span>Advanced Prompt Settings</span>
                <i class="fa-solid fa-chevron-down rabbit-advanced-toggle"></i>
            </div>

            <div id="rabbit-advanced-body" class="rabbit-advanced-body" style="display: none;">
                <div class="rabbit-setting-row">
                    <label for="rabbit_custom_prompt">
                        Custom Prompt Template:
                    </label>
                    <textarea id="rabbit_custom_prompt" name="rabbit_custom_prompt"
                              rows="4"
                              style="width: 100%; padding: 8px; border-radius: 6px;
                                     background: var(--black30a); color: var(--SmartThemeBodyColor);
                                     border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        Use <code>{{words}}</code> macro to insert the random words. Example: "Use these words: {{words}}"
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <label for="rabbit_injection_depth">
                        Injection Depth:
                    </label>
                    <input type="number" id="rabbit_injection_depth" name="rabbit_injection_depth"
                           min="0" max="50" value="0"
                           style="width: 100%; padding: 8px; border-radius: 6px;
                                  background: var(--black30a); color: var(--SmartThemeBodyColor);
                                  border: 1px solid rgba(147, 51, 234, 0.3);" />
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        0 = just before assistant prefill (if present), higher values = insert further up
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <label for="rabbit_injection_end_role">
                        Injection Role:
                    </label>
                    <select id="rabbit_injection_end_role" name="rabbit_injection_end_role" style="width: 100%; padding: 8px;">
                        <option value="system">System</option>
                        <option value="user">User</option>
                        <option value="assistant">Assistant</option>
                    </select>
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        Which role the injected message should use (system/user/assistant)
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <label for="rabbit_word_blacklist">
                        Word Blacklist:
                    </label>
                    <textarea id="rabbit_word_blacklist" name="rabbit_word_blacklist"
                              rows="2"
                              placeholder="e.g., inappropriate, complex, difficult"
                              style="width: 100%; padding: 8px; border-radius: 6px;
                                     background: var(--black30a); color: var(--SmartThemeBodyColor);
                                     border: 1px solid rgba(147, 51, 234, 0.3); resize: vertical;"></textarea>
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        Comma-separated list of words to never inject (case-insensitive)
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <label for="rabbit_history_size">
                        Word History Size:
                    </label>
                    <input type="number" id="rabbit_history_size" name="rabbit_history_size"
                           min="0" max="100" value="20"
                           style="width: 100%; padding: 8px; border-radius: 6px;
                                  background: var(--black30a); color: var(--SmartThemeBodyColor);
                                  border: 1px solid rgba(147, 51, 234, 0.3);" />
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        Track recently used words to avoid repeats (0 = disabled, auto-regenerates duplicates)
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <label for="rabbit_min_message_length">
                        Minimum Message Length:
                    </label>
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
                    <small style="opacity: 0.7; display: block; margin-top: 5px;">
                        Display the most recently injected words in the extension header
                    </small>
                </div>

                <div class="rabbit-setting-row">
                    <button id="rabbit_reset_prompt" class="rabbit-reset-button">
                        <i class="fa-solid fa-rotate-left"></i> Reset to Default Template
                    </button>
                </div>
            </div>

            </div>
        </div>
    `;

    $('#extensions_settings2').append(settingsHtml);

    // Initialize collapse toggles
    $('.rabbit-header').on('click', function() {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        $('#rabbit-settings-body').slideToggle(300);
    });

    $('.rabbit-advanced-header').on('click', function() {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        $('#rabbit-advanced-body').slideToggle(300);
    });

    // Event listeners
    $('#rabbit_enabled').on('change', saveSettings);

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

    // Heroku-specific
    $('#rabbit_language').on('change', saveSettings);

    // Vercel-specific
    $('#rabbit_first_letter').on('change', saveSettings);
    $('#rabbit_alphabetize').on('change', saveSettings);

    $('#rabbit_test').on('click', async function() {
        const count = parseInt($('#rabbit_word_count').val());
        const provider = $('#rabbit_api_provider').val();

        toastr.info(`Fetching ${count} random words from ${provider}...`, 'Rabbit Response Team');

        const words = await getRandomWords(count);

        if (words.length > 0) {
            toastr.success(`Random words: ${words.join(', ')}`, 'Rabbit Response Team', { timeOut: 10000 });
        } else {
            toastr.error('Failed to get random words!', 'Rabbit Response Team');
        }
    });

    // Advanced settings
    $('#rabbit_custom_prompt').on('input', saveSettings);
    $('#rabbit_injection_depth').on('input', saveSettings);
    $('#rabbit_injection_end_role').on('change', saveSettings);
    $('#rabbit_word_blacklist').on('input', saveSettings);
    $('#rabbit_history_size').on('input', saveSettings);
    $('#rabbit_min_message_length').on('input', saveSettings);
    $('#rabbit_show_last_words').on('change', saveSettings);

    $('#rabbit_reset_prompt').on('click', function() {
        $('#rabbit_custom_prompt').val(DEFAULT_PROMPT_TEMPLATE);
        saveSettings();
        toastr.success('Prompt template reset to default', 'Rabbit Response Team');
    });

    // Initial call to show/hide API-specific options based on current selection
    updateAPIOptions();

    console.log('🐰 Rabbit Response Team: Settings UI created');
}

// Initialize extension
jQuery(async () => {
    // Create UI
    createSettingsUI();

    // Load settings
    loadSettings();

    console.log('🐰 Rabbit Response Team: Extension initialized');
});
