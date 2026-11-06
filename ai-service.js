const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const db = require('./db');
const civilbot = require('./lib/civilbot');

// The Claude client is created lazily and only when a real key is present.
// ANTHROPIC_API_KEY in a fresh checkout is a placeholder, and using it produced
// a hard 401 from the API, which is what made the assistant look broken.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
// OpenRouter uses different model naming (e.g., openai/gpt-4o-mini)
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o-mini';

// Advanced system prompt for the AI chatbot
const ADVANCED_SYSTEM_PROMPT = `You are CivilBot Advanced, the AI-powered civic assistant for the Municipal Citizen Services portal in India.

Your capabilities:
1. **Complaint Filing Assistance** - Guide citizens through filing complaints with proper categorization, location pinning, and evidence attachment
2. **Status Tracking & Updates** - Help citizens track their complaints using CMP- reference numbers, explain status meanings
3. **Service Application Guidance** - Assist with online service applications (birth/death certificates, licenses, permits)
4. **Bill Payments** - Guide citizens through paying municipal bills (electricity, water, property tax)
5. **Portal Navigation** - Direct users to the right sections (Dashboard, Complaints, Services, Track, Transparency)
6. **Escalation & Reopening** - Explain escalation process, how to request reopening if issue not resolved
7. **Department & Ward Information** - Provide accurate department contacts, ward details, officer assignments
8. **Real-time Portal Data** - Access live data about categories, subcategories, departments, wards, SLA targets

Guidelines:
- Be conversational, warm, and helpful - use plain language, not bureaucratic jargon
- Keep responses concise (3-5 sentences) unless user asks for details
- Always ground answers in the portal's actual data - never invent reference numbers, phone numbers, or deadlines
- If you don't know something from portal data, say so and direct to the relevant portal page
- Proactively offer quick action buttons when relevant
- Use the conversation history to maintain context
- For complex multi-step processes, break into clear numbered steps
- Acknowledge the user's specific situation (signed-in status, recent complaints, etc.)

Reference numbers: CMP-YYYY-NNNNNN for complaints, APP-YYYY-NNNNNN for applications.
Statuses: Submitted, Under Review, Assigned, In Progress, Resolved, Rejected, Reopened, Closed
Priorities: critical, high, medium, low (drive internal resolution targets)

**IMPORTANT: Output Format**
You MUST respond ONLY in valid JSON format with these exact fields:
{
  "response": "Your conversational response text here",
  "actions": [
    { "label": "Button Text", "action": "action_identifier", "data": {} }
  ]
}

Rules:
- ALWAYS output valid JSON - no extra text, no markdown, no explanation outside the JSON
- The "actions" array is optional but should be included when user asks for help, options, quick actions, or when relevant
- Standard action identifiers (use exactly these):
  - file_complaint: Open complaint filing
  - track_complaint: Track a complaint
  - service_application: Apply for a service
  - apply_document: Apply for a document (birth/death/marriage certificate, etc.)
  - pay_bills: Pay municipal bills
  - nav_dashboard: Go to dashboard
  - nav_contact: Contact municipality
  - nav_complaints: Go to complaints page
  - nav_services: Go to services page
  - nav_track: Go to track page
- apply_document: Apply for a document (birth/death/marriage certificate, etc.)

Example for "what can you do":
{"response":"Here are the main things I can help you with:","actions":[{"label":"File a Complaint","action":"file_complaint","data":{}},{"label":"Track Complaint","action":"track_complaint","data":{}},{"label":"Apply for Service","action":"service_application","data":{}},{"label":"Apply for Document","action":"apply_document","data":{}},{"label":"Pay Bills","action":"pay_bills","data":{}},{"label":"View Dashboard","action":"nav_dashboard","data":{}},{"label":"Contact Municipality","action":"nav_contact","data":{}}]}

Example for "how to apply for birth certificate":
{"response":"To apply for a birth certificate: 1) Go to Services → Certificates, 2) Select 'Birth Certificate', 3) Fill in the required details (child's name, parents' names, date/place of birth), 4) Upload required documents (hospital birth proof, parents' ID proofs), 5) Submit and track with APP- reference number.","actions":[{"label":"Apply for Birth Certificate","action":"apply_document","data":{"type":"birth_certificate"}},{"label":"View All Documents","action":"service_application","data":{}}]}

Example for "how to file pothole complaint":
{"response":"To file a pothole complaint: 1) Select 'Roads and Transport' category, 2) Describe the pothole, 3) Pin location on map, 4) Attach photos if available.","actions":[{"label":"File a Complaint","action":"file_complaint","data":{}}]}`;

function anthropicApiKey() {
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return null;
  if (/^(your|changeme|placeholder|demo|test|xxx)/i.test(key)) return null;
  if (/^sk-ant-api03-demo/i.test(key)) return null;
  return key.length >= 20 ? key : null;
}

let anthropicClient = null;
function anthropic() {
  const apiKey = anthropicApiKey();
  if (!apiKey) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

function anthropicEnabled() {
  return Boolean(anthropicApiKey());
}

// ---------------------------------------------------------------------------
// OpenAI integration (primary AI provider for the chatbot)
// ---------------------------------------------------------------------------
function openaiApiKey() {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if (!key) return null;
  if (/^(your|changeme|placeholder|demo|test|xxx)/i.test(key)) return null;
  return key.length >= 20 ? key : null;
}

let openaiClient = null;
function openai() {
  const apiKey = openaiApiKey();
  if (!apiKey) return null;
  if (!openaiClient) {
    // Support both OpenAI and OpenRouter (OpenRouter keys start with sk-or-)
    const isOpenRouter = apiKey.startsWith('sk-or-');
    openaiClient = new OpenAI({
      apiKey,
      baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined
    });
  }
  return openaiClient;
}

function openaiEnabled() {
  return Boolean(openaiApiKey());
}

async function openaiReply(userMessage, conversationHistory, context) {
  const client = openai();
  if (!client) return null;

  const kb = await civilbot.loadKnowledge();
  const user = context?.user;
  const isSignedIn = !!user;

  // Build context-aware system prompt
  const systemPrompt = buildAdvancedSystemPrompt(kb, user, context);

  // Prepare messages with conversation history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : []),
    { role: 'user', content: String(userMessage) }
  ];

  const completion = await client.chat.completions.create({
    model: DEFAULT_OPENAI_MODEL,
    messages,
    max_tokens: 800,
    temperature: 0.3,
    presence_penalty: 0.1,
    frequency_penalty: 0.1
  });

  const text = (completion.choices?.[0]?.message?.content || '').trim();

  // Try to parse structured response with actions
  let response = { text: null, actions: null };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      response.text = parsed.response || parsed.text || parsed.message;
      response.actions = parsed.actions || null;
    }
  } catch (e) {
    // Not JSON, treat as plain text
    response.text = text;
  }

  return response.text ? { response: response.text, actions: response.actions } : null;
}

/**
 * Build an advanced, context-aware system prompt
 */
function buildAdvancedSystemPrompt(kb, user, context) {
  const categories = kb.categories
    .map((category) => `- ${category.name}: ${category.description || ''}`.trim())
    .join('\n');

  const targets = ['critical', 'high', 'medium', 'low']
    .filter((priority) => kb.targets[priority])
    .map((priority) => `${priority} ${kb.targets[priority]}h`)
    .join(', ');

  const departments = kb.departments.map(d => d.name).join(', ');
  const wardsCount = kb.wards.length;

  // User-specific context
  let userContext = '';
  if (user) {
    userContext = `\n\nUSER CONTEXT:
- Signed in as: ${user.name || user.email} (${user.role})
- User ID: ${user.id}
- Can access: Dashboard, My Complaints, My Applications, My Payments, Notifications`;
  } else {
    userContext = '\n\nUSER CONTEXT: Not signed in. Can only track by reference number + email.';
  }

  // Recent complaints context if available
  let recentComplaintsContext = '';
  if (context?.recentComplaints?.length) {
    recentComplaintsContext = '\n\nRECENT COMPLAINTS:\n' + context.recentComplaints.map(c =>
      `- ${c.reference_no}: ${c.title} (${c.status})`
    ).join('\n');
  }

  return `${ADVANCED_SYSTEM_PROMPT}

PORTAL LIVE DATA:
Complaint statuses: ${Object.keys({
  Submitted: 'received, awaiting triage',
  'Under Review': 'being verified',
  Assigned: 'routed to a department',
  'In Progress': 'work has started',
  Resolved: 'marked resolved, awaiting citizen feedback',
  Rejected: 'not actioned, reason recorded',
  Reopened: 'citizen contested the resolution',
  Closed: 'final'
}).join(', ')}.
Internal resolution targets: ${targets || 'not configured'}.

Categories on this portal:
${categories}

Departments: ${departments}.
Wards: ${wardsCount} wards.
Reference numbers: CMP-YYYY-NNNNNN for complaints, APP-YYYY-NNNNNN for service applications.
${userContext}
${recentComplaintsContext}

Be brief, warm and concrete — 3-5 sentences, or a short list when the citizen asks for steps. Use plain language, not bureaucratic jargon.`;
}

/**
 * Analyze complaint for fake/spam detection and redundancy
 */
async function analyzeComplaint(complaint) {
  try {
    // Get recent similar complaints for redundancy check
    const recentComplaints = await getRecentSimilarComplaints(complaint.category);

    const prompt = `You are an AI assistant helping a municipal government detect fake, spam, or redundant complaints.

Analyze this complaint:
Category: ${complaint.category}
Description: ${complaint.description}
Location: ${complaint.location_text || 'Not specified'}

Recent similar complaints in the same category:
${recentComplaints.map((c, i) => `${i + 1}. "${c.description}" at ${c.location_text || 'location not specified'}`).join('\n')}

Provide analysis in this JSON format:
{
  "is_valid": boolean,
  "confidence_score": number (0-100),
  "issues": ["list of issues found"],
  "is_duplicate": boolean,
  "duplicate_of_id": number or null,
  "severity_level": "low" | "medium" | "high" | "critical",
  "category_accuracy": number (0-100),
  "suggested_category": "string or null",
  "priority_recommendation": "low" | "medium" | "high",
  "reasoning": "brief explanation"
}

Consider:
- Is the description coherent and detailed enough?
- Does it sound like spam or gibberish?
- Is it extremely similar to recent complaints (possible duplicate)?
- Does the severity match the description?
- Is the category appropriate for the description?`;

    // Prefer OpenAI when configured, fall back to Claude.
    const client = openai() || anthropic();
    if (!client) throw new Error('No AI API key is configured');

    let responseText;
    if (openaiEnabled()) {
      const completion = await client.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      });
      responseText = (completion.choices?.[0]?.message?.content || '').trim();
    } else {
      const message = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      responseText = message.content[0].text;
    }
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        analysis: {
          is_valid: analysis.is_valid !== false,
          confidence_score: analysis.confidence_score || 50,
          issues: analysis.issues || [],
          is_duplicate: analysis.is_duplicate || false,
          duplicate_of_id: analysis.duplicate_of_id || null,
          severity_level: analysis.severity_level || 'medium',
          category_accuracy: analysis.category_accuracy || 100,
          suggested_category: analysis.suggested_category || null,
          priority_recommendation: analysis.priority_recommendation || 'medium',
          reasoning: analysis.reasoning || 'Analysis completed',
          analyzed_at: new Date().toISOString()
        }
      };
    }

    return {
      success: true,
      analysis: {
        is_valid: true,
        confidence_score: 50,
        issues: [],
        reasoning: 'Could not parse AI response, marked as valid by default'
      }
    };
  } catch (error) {
    console.error('AI analysis error:', error.message);
    return {
      success: false,
      error: error.message,
      analysis: {
        is_valid: true,
        confidence_score: 50,
        issues: ['AI analysis unavailable'],
        reasoning: 'AI service error, marked as valid by default'
      }
    };
  }
}

/**
 * Get recent complaints in the same category for redundancy checking
 */
function getRecentSimilarComplaints(category) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, description, location_text, created_at
       FROM complaints
       WHERE category = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [category],
      (err, rows) => {
        if (err) {
          console.error('Error fetching similar complaints:', err);
          resolve([]);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

/**
 * CivilBot — the portal's civic assistant.
 *
 * CivilBot answers from the portal's own live data (see lib/civilbot.js), so it
 * works with no API key, no network access and no cost. When a real Anthropic
 * key is configured, Claude is asked first for a more conversational reply and
 * CivilBot becomes the fallback, which means the assistant never returns a
 * "trouble connecting" message.
 */
function groundedSystemPrompt(kb) {
  const categories = kb.categories
    .map((category) => `- ${category.name}: ${category.description || ''}`.trim())
    .join('\n');
  const targets = ['critical', 'high', 'medium', 'low']
    .filter((priority) => kb.targets[priority])
    .map((priority) => `${priority} ${kb.targets[priority]}h`)
    .join(', ');

  return `You are CivilBot, the citizen assistant on a municipal civic issue portal in India.
You help citizens report civic issues, understand the process, and find out where their complaint has reached.

Only use the facts below. If something is not covered, say you do not know and point the citizen to the relevant page of the portal. Never invent a reference number, a phone number, a deadline or a department.

Complaint statuses: ${Object.keys(STATUS_HELP_FOR_PROMPT).join(', ')}.
Internal resolution targets: ${targets || 'not configured'}.

Categories on this portal:
${categories}

Departments: ${kb.departments.map((d) => d.name).join(', ')}.
Wards: ${kb.wards.length} wards.
Reference numbers: CMP-YYYY-NNNNNN for complaints, APP-YYYY-NNNNNN for service applications.

Be brief, warm and concrete — two to four sentences, or a short list when the citizen asks for steps. Use plain language, not bureaucratic jargon.`;
}

const STATUS_HELP_FOR_PROMPT = {
  Submitted: 'received, awaiting triage',
  'Under Review': 'being verified',
  Assigned: 'routed to a department',
  'In Progress': 'work has started',
  Resolved: 'marked resolved, awaiting citizen feedback',
  Rejected: 'not actioned, reason recorded',
  Reopened: 'citizen contested the resolution',
  Closed: 'final'
};

async function claudeReply(userMessage, conversationHistory, context) {
  const client = anthropic();
  if (!client) return null;
  const kb = await civilbot.loadKnowledge();
  const systemPrompt = buildAdvancedSystemPrompt(kb, context?.user, context);
  const messages = [
    ...(Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : []),
    { role: 'user', content: String(userMessage) }
  ];
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 800,
    temperature: 0.3,
    system: systemPrompt,
    messages: messages
  });
  const text = (message.content || [])
    .map((block) => (block && block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

  // Try to parse structured response with actions
  let response = { text: null, actions: null };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      response.text = parsed.response || parsed.text || parsed.message;
      response.actions = parsed.actions || null;
    }
  } catch (e) {
    // Not JSON, treat as plain text
    response.text = text;
  }

  return response.text ? { response: response.text, actions: response.actions } : null;
}

async function getChatbotResponse(userMessage, conversationHistory = [], context = {}) {
  const question = String(userMessage || '').trim();

  // Fetch recent complaints for signed-in users to provide personalized context
  let recentComplaints = null;
  if (context?.user?.id) {
    try {
      recentComplaints = await new Promise((resolve, reject) => {
        db.all(
          `SELECT c.reference_no, c.title, c.status, c.priority, c.due_at, c.created_at,
                  d.name AS department_name, u.name AS officer_name
           FROM complaints c
           LEFT JOIN departments d ON d.id = c.department_id
           LEFT JOIN users u ON u.id = c.assigned_user_id
           WHERE c.user_id = ?
           ORDER BY c.created_at DESC LIMIT 5`,
          [context.user.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    } catch (error) {
      console.error('Failed to fetch recent complaints for chatbot context:', error.message);
    }
  }

  const enrichedContext = {
    ...context,
    recentComplaints
  };

  // OpenAI is the primary AI provider when a real key is configured.
  if (openaiEnabled()) {
    try {
      const reply = await openaiReply(question, conversationHistory, enrichedContext);
      if (reply) {
        // openaiReply now returns { response: "...", actions: [...] }
        if (typeof reply === 'object' && reply.response) {
          return { success: true, source: 'openai', response: reply.response, actions: reply.actions };
        }
        return { success: true, source: 'openai', response: reply };
      }
    } catch (error) {
      console.error('CivilBot OpenAI fallback:', error.message);
    }
  }

  // Claude is the secondary provider.
  if (anthropicEnabled()) {
    try {
      const reply = await claudeReply(question, conversationHistory, enrichedContext);
      if (reply) return { success: true, source: 'claude', response: reply };
    } catch (error) {
      console.error('CivilBot Claude fallback:', error.message);
    }
  }

  // CivilBot (built-in, always available) is the final fallback.
  try {
    const local = await civilbot.answer(question, {
      user: context.user,
      action: context.action,
      actionData: context.actionData
    });

    // Handle special response format with actions
    // civilbot returns { response: { response: "...", actions: [...] }, intent: "..." }
    // or { response: "...", intent: "..." }
    let responseText = local.response;
    let actions = null;
    let intent = local.intent;

    if (local && typeof local === 'object' && local.response && typeof local.response === 'object' && local.response.actions) {
      responseText = local.response.response;
      actions = local.response.actions;
    } else if (local && typeof local === 'object' && local.actions) {
      responseText = local.response;
      actions = local.actions;
    }

    return { success: true, source: 'civilbot', intent, response: responseText, actions };
  } catch (error) {
    console.error('CivilBot error:', error.message);
    return {
      success: false,
      source: 'civilbot',
      intent: 'error',
      response:
        'I cannot read the portal records at the moment, so I would rather not guess. Please try again shortly, or open the Complaints section to file or track your complaint directly.'
    };
  }
}

/**
 * Generate admin dashboard insights
 */
async function generateAdminInsights(stats) {
  try {
    const prompt = `Analyze this municipal complaint data and provide brief insights:

Statistics:
- Total Complaints: ${stats.total || 0}
- Pending: ${stats.pending || 0}
- In Progress: ${stats.inProgress || 0}
- Resolved: ${stats.resolved || 0}
- Resolution Rate: ${stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : 0}%

By Category:
${stats.byCategory ? stats.byCategory.map(c => `- ${c.category}: ${c.count}`).join('\n') : 'No data'}

Provide a JSON response with:
{
  "key_insights": ["3-4 brief insights"],
  "recommendations": ["2-3 actionable recommendations"],
  "alert_areas": ["areas needing attention"],
  "performance_summary": "brief summary"
}`;

    const client = anthropic();
    if (!client) throw new Error('ANTHROPIC_API_KEY is not configured');

    const message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return {
        success: true,
        insights: JSON.parse(jsonMatch[0])
      };
    }

    return {
      success: false,
      insights: {
        key_insights: ['AI insights temporarily unavailable'],
        recommendations: [],
        alert_areas: [],
        performance_summary: 'Data analysis pending'
      }
    };
  } catch (error) {
    console.error('Admin insights error:', error.message);
    return {
      success: false,
      error: error.message,
      insights: {
        key_insights: ['AI insights temporarily unavailable'],
        recommendations: [],
        alert_areas: []
      }
    };
  }
}

module.exports = {
  analyzeComplaint,
  getChatbotResponse,
  generateAdminInsights,
  openaiEnabled,
  anthropicEnabled
};
