import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Download,
  Edit3,
  Eye,
  RefreshCw,
  Save,
  Send,
  Upload,
  User,
} from 'lucide-react';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? '';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const cloneConfig = (config) => JSON.parse(JSON.stringify(config));

const DEFAULT_PROMPT_CONFIG = {
  personas: {
    Seeker: {
      name: 'Seeker',
      description: 'Low energy, overwhelmed, needs smallest actions',
      prompt:
        "SEEKER PERSONA - Low energy, overwhelmed:\n• Use SMALLEST actions (30-60 seconds)\n• Give 1 option only\n• Heavy emotional validation first\n• Response length: 20-30 words MAX",
      wordLimit: '20-30',
    },
    Explorer: {
      name: 'Explorer',
      description: 'Mid-energy, curious, playful',
      prompt:
        "EXPLORER PERSONA - Curious, playful:\n• Frame as experiments\n• Use playful language\n• Can offer 2 options\n• Response length: 25-35 words MAX",
      wordLimit: '25-35',
    },
    Tracker: {
      name: 'Tracker',
      description: 'Stable, data-driven, optimization focused',
      prompt:
        "TRACKER PERSONA - Data-driven, optimization:\n• Reference data and trends\n• Use structured language\n• Include metrics\n• Response length: 30-40 words MAX",
      wordLimit: '30-40',
    },
  },
  phases: {
    Soothe: {
      name: 'Soothe',
      days: '0-3',
      prompt:
        "PHASE: Soothe - Practice: 30-60 seconds ONLY. Never suggest over 1 minute. Extremely gentle tone.",
      practiceLength: '30-60 seconds',
    },
    Stabilize: {
      name: 'Stabilize',
      days: '3-6',
      prompt:
        "PHASE: Stabilize - Practice: 2-5 minutes. Reference 'rhythm' or 'consistency'. Gentle accountability tone.",
      practiceLength: '2-5 minutes',
    },
    Strengthen: {
      name: 'Strengthen',
      days: '5-7',
      prompt:
        "PHASE: Strengthen - Practice: 3-10 minutes. Use identity language like 'you're someone who...'. Resilience tone.",
      practiceLength: '3-10 minutes',
    },
    Maintenance: {
      name: 'Maintenance',
      days: 'Post-reset',
      prompt:
        "PHASE: Maintenance - Practice: Flexible 2-5 minutes. Trust their judgment. Light check-in tone.",
      practiceLength: '2-5 minutes flexible',
    },
  },
  emotions: {
    soft_hopefulness: {
      name: 'Soft Hopefulness',
      description: 'Gentle encouragement after rough patch',
      prompt:
        "SOFT HOPEFULNESS:\nMUST use: 'we can try', 'tiny start', 'proud you're here'\nExample: 'That sounds heavy. Want to try one breath together?'",
      keywords: ['we can try', 'tiny start', "proud you're here"],
    },
    grounded_calm: {
      name: 'Grounded Calm',
      description: 'Help anxious user downshift',
      prompt:
        "GROUNDED CALM:\nMUST use: 'slow down', 'one breath', 'nothing urgent', 'let's pause'\nExample: 'Let's pause. Can we take one breath right now?'",
      keywords: ['slow down', 'one breath', 'nothing urgent', "let's pause"],
    },
    attentive_empathy: {
      name: 'Attentive Empathy',
      description: 'Deep validation without rushing',
      prompt:
        "ATTENTIVE EMPATHY:\nMUST use: 'that sounds hard', 'I hear you', 'you don't have to', 'I'm here'\nExample: 'That sounds really hard. You don't have to fix it tonight.'",
      keywords: ['that sounds hard', 'I hear you', "you don't have to"],
    },
    clear_focus: {
      name: 'Clear Focus',
      description: 'Concrete step-by-step instructions',
      prompt:
        "CLEAR FOCUS:\nMUST use numbered steps (1), (2), (3) OR 'here's what to do:'\nExample: 'Do this: (1) Sit down (2) Take 3 breaths (3) Notice how you feel.'\nFORMAT REQUIRED: Structured with clear steps.",
      keywords: ['do this:', "here's what to do", 'step 1', 'first, then, next'],
    },
  },
  globalRules: {
    prompt:
      "GLOBAL RULES:\n• Be conversational like texting a friend\n• Validate emotion FIRST\n• Suggest ONE tiny action\n• Never shame or guilt\n• Use contractions and simple words",
  },
};

const TEST_PROFILES = {
  aastha: {
    name: 'Aastha (Seeker)',
    persona: 'Seeker',
    context: 'Recovering from ACL surgery. Low energy, fragmented sleep, afternoon slump 2-5 PM.',
  },
  priya: {
    name: 'Priya (Explorer)',
    persona: 'Explorer',
    context: 'Working professional, moderate energy, curious, experiences brain fog.',
  },
  rahul: {
    name: 'Rahul (Tracker)',
    persona: 'Tracker',
    context: 'Stable baseline, tracks HRV/sleep, exercises 4x/week, optimization-focused.',
  },
};

const quickTestMessages = [
  "I'm feeling anxious",
  "I'm tired today",
  'What should I do?',
  'I did the breathing exercise!',
  'I feel lazy',
];

const toEmotionLabel = (key) => key.replace(/_/g, ' ');

function PromptEngineeringWorkbench() {
  const [promptConfig, setPromptConfig] = useState(() => cloneConfig(DEFAULT_PROMPT_CONFIG));
  const [testProfiles, setTestProfiles] = useState(() => cloneConfig(TEST_PROFILES));
  const [selectedProfile, setSelectedProfile] = useState('aastha');
  const [selectedPersona, setSelectedPersona] = useState('Seeker');
  const [selectedPhase, setSelectedPhase] = useState('Soothe');
  const [selectedEmotion, setSelectedEmotion] = useState('soft_hopefulness');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [profileContextEdit, setProfileContextEdit] = useState(null);
  const [profileContextDraft, setProfileContextDraft] = useState('');

  const messagesEndRef = useRef(null);
  const profile = testProfiles[selectedProfile];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystemPrompt = () => {
    const personaPrompt = promptConfig.personas[selectedPersona].prompt;
    const phasePrompt = promptConfig.phases[selectedPhase].prompt;
    const emotionPrompt = promptConfig.emotions[selectedEmotion].prompt;
    const globalPrompt = promptConfig.globalRules.prompt;

    return `You are NextYou AI Buddy.

USER: ${profile.name}
Context: ${profile.context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${personaPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${phasePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 EMOTIONAL STATE: ${toEmotionLabel(selectedEmotion).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${emotionPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${globalPrompt}

NOW respond using the settings above:`;
  };

  const pushAssistantMessage = (content, metadata = {}, error = false) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        metadata,
        error,
      },
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    const conversation = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    if (!OPENAI_API_KEY) {
      pushAssistantMessage(
        '❌ Missing OpenAI API key. Add VITE_OPENAI_API_KEY to a .env file.',
        {},
        true,
      );
      return;
    }

    setIsLoading(true);
    try {
      const systemPrompt = buildSystemPrompt();
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 150,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversation.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data?.choices?.[0]?.message?.content ?? 'No response received.';

      pushAssistantMessage(assistantResponse, {
        persona: selectedPersona,
        phase: selectedPhase,
        emotion: selectedEmotion,
        wordCount: assistantResponse.split(' ').length,
      });
    } catch (error) {
      pushAssistantMessage(`❌ Error: ${error.message}`, {}, true);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (type, key) => {
    setEditMode({ type, key });
    if (type === 'persona') {
      setEditingPrompt(promptConfig.personas[key].prompt);
    } else if (type === 'phase') {
      setEditingPrompt(promptConfig.phases[key].prompt);
    } else if (type === 'emotion') {
      setEditingPrompt(promptConfig.emotions[key].prompt);
    } else if (type === 'global') {
      setEditingPrompt(promptConfig.globalRules.prompt);
    }
  };

  const saveEdit = () => {
    if (!editMode) return;

    const { type, key } = editMode;
    setPromptConfig((prev) => {
      const updated = cloneConfig(prev);

      if (type === 'persona') {
        updated.personas[key].prompt = editingPrompt;
      } else if (type === 'phase') {
        updated.phases[key].prompt = editingPrompt;
      } else if (type === 'emotion') {
        updated.emotions[key].prompt = editingPrompt;
      } else if (type === 'global') {
        updated.globalRules.prompt = editingPrompt;
      }

      return updated;
    });

    setEditMode(null);
    setEditingPrompt('');
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(promptConfig, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nextyou-prompt-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setPromptConfig(cloneConfig(imported));
          alert('Configuration imported successfully!');
        } catch (error) {
          alert(`Error importing configuration: ${error.message}`);
        }
        input.value = '';
      };
      reader.readAsText(file);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Reset all prompts to defaults?')) {
      setPromptConfig(cloneConfig(DEFAULT_PROMPT_CONFIG));
      setTestProfiles(cloneConfig(TEST_PROFILES));
    }
  };

  const startEditingProfileContext = (key) => {
    setProfileContextEdit(key);
    setProfileContextDraft(testProfiles[key].context);
  };

  const saveProfileContext = () => {
    if (!profileContextEdit) return;
    setTestProfiles((prev) => {
      const updated = cloneConfig(prev);
      updated[profileContextEdit].context = profileContextDraft;
      return updated;
    });
    setProfileContextEdit(null);
    setProfileContextDraft('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">NextYou Prompt Engineering Workbench</h1>
              <p className="text-gray-600">Edit prompts in JSON format and test instantly with live AI</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportConfig}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                <Download size={16} />
                Export
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 cursor-pointer">
                <Upload size={16} />
                Import
                <input type="file" accept=".json" onChange={importConfig} className="hidden" />
              </label>
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw size={16} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="font-semibold">Profile:</span>
                <span className="ml-2 text-blue-900">{profile.name}</span>
              </div>
              <div>
                <span className="font-semibold">Persona:</span>
                <span className="ml-2 text-purple-900">{selectedPersona}</span>
              </div>
              <div>
                <span className="font-semibold">Phase:</span>
                <span className="ml-2 text-pink-900">{selectedPhase}</span>
              </div>
              <div>
                <span className="font-semibold">Emotion:</span>
                <span className="ml-2 text-indigo-900">{toEmotionLabel(selectedEmotion)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold mb-2">Test Profile</h3>
              <select
                value={selectedProfile}
                onChange={(e) => {
                  setSelectedProfile(e.target.value);
                  setMessages([]);
                }}
                className="w-full p-2 border rounded"
              >
                <option value="aastha">Aastha (Seeker)</option>
                <option value="priya">Priya (Explorer)</option>
                <option value="rahul">Rahul (Tracker)</option>
              </select>
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-700">Context</span>
                  <button
                    onClick={() => startEditingProfileContext(selectedProfile)}
                    className="text-blue-600 text-xs hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-xs">{profile.context}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Persona Prompts</h3>
                <span className="text-xs text-gray-500">Click to edit</span>
              </div>
              <div className="space-y-2">
                {Object.entries(promptConfig.personas).map(([key, persona]) => (
                  <div key={key} className="border rounded p-2">
                    <div className="flex justify-between items-start mb-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="persona"
                          checked={selectedPersona === key}
                          onChange={() => {
                            setSelectedPersona(key);
                            setMessages([]);
                          }}
                        />
                        <span className="font-semibold text-sm">{persona.name}</span>
                      </label>
                      <button
                        onClick={() => startEditing('persona', key)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{persona.description}</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {persona.prompt.substring(0, 80)}...
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Phase Prompts</h3>
                <span className="text-xs text-gray-500">Click to edit</span>
              </div>
              <div className="space-y-2">
                {Object.entries(promptConfig.phases).map(([key, phase]) => (
                  <div key={key} className="border rounded p-2">
                    <div className="flex justify-between items-start mb-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="phase"
                          checked={selectedPhase === key}
                          onChange={() => {
                            setSelectedPhase(key);
                            setMessages([]);
                          }}
                        />
                        <span className="font-semibold text-sm">
                          {phase.name} ({phase.days})
                        </span>
                      </label>
                      <button
                        onClick={() => startEditing('phase', key)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {phase.prompt.substring(0, 80)}...
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Emotional State Prompts</h3>
                <span className="text-xs text-gray-500">Click to edit</span>
              </div>
              <div className="space-y-2">
                {Object.entries(promptConfig.emotions).map(([key, emotion]) => (
                  <div key={key} className="border rounded p-2">
                    <div className="flex justify-between items-start mb-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="emotion"
                          checked={selectedEmotion === key}
                          onChange={() => {
                            setSelectedEmotion(key);
                            setMessages([]);
                          }}
                        />
                        <span className="font-semibold text-sm">{emotion.name}</span>
                      </label>
                      <button
                        onClick={() => startEditing('emotion', key)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{emotion.description}</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {emotion.prompt.substring(0, 80)}...
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Global Rules</h3>
                <button
                  onClick={() => startEditing('global', 'global')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit3 size={16} />
                </button>
              </div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {promptConfig.globalRules.prompt}
              </pre>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <button
                onClick={() => setShowFullPrompt((v) => !v)}
                className="w-full flex items-center justify-between p-2 bg-yellow-50 rounded hover:bg-yellow-100"
              >
                <span className="font-semibold">View Combined System Prompt</span>
                <Eye size={16} />
              </button>
              {showFullPrompt && (
                <pre className="mt-3 text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                  {buildSystemPrompt()}
                </pre>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg flex flex-col h-[calc(100vh-400px)]">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Live AI Testing</h2>
                  <p className="text-sm text-gray-600">
                    {selectedPersona} • {selectedPhase} • {toEmotionLabel(selectedEmotion)}
                  </p>
                </div>
                <button
                  onClick={() => setMessages([])}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  Clear
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-8">
                    <Bot size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="mb-4">Quick test messages:</p>
                    <div className="space-y-2">
                      {quickTestMessages.map((msg) => (
                        <button
                          key={msg}
                          onClick={() => setInputMessage(msg)}
                          className="block w-full text-left p-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
                        >
                          "{msg}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={`${msg.timestamp}-${idx}`}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : msg.error
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.wordCount && (
                        <div className="text-xs mt-1 opacity-70">{msg.metadata.wordCount} words</div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <Bot size={16} className="text-white" />
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoading) {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a test message..."
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {editMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Edit {editMode.type === 'global' ? 'Global Rules' : `${editMode.key} Prompt`}
                </h3>
                <button onClick={() => setEditMode(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                <textarea
                  value={editingPrompt}
                  onChange={(e) => setEditingPrompt(e.target.value)}
                  className="w-full h-64 p-3 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter prompt instructions..."
                />
                <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm">
                  <p className="font-semibold mb-1">Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Use "MUST" for critical requirements</li>
                    <li>Provide concrete examples</li>
                    <li>Specify word counts or formats</li>
                    <li>Test changes immediately in chat</li>
                  </ul>
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button
                  onClick={() => setEditMode(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-2"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        {profileContextEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Edit {testProfiles[profileContextEdit].name} Context
                </h3>
                <button
                  onClick={() => {
                    setProfileContextEdit(null);
                    setProfileContextDraft('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  value={profileContextDraft}
                  onChange={(e) => setProfileContextDraft(e.target.value)}
                  className="w-full h-40 p-3 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe this profile's context..."
                />
                <p className="text-xs text-gray-500">
                  This context appears in the system prompt and should capture the user's current situation.
                </p>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button
                  onClick={() => {
                    setProfileContextEdit(null);
                    setProfileContextDraft('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfileContext}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Context
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PromptEngineeringWorkbench;
