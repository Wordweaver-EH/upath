# Gemini REST API & Thinking Models Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Thinking Models](#thinking-models)
5. [Request & Response Format](#request--response-format)
6. [Thought Summaries](#thought-summaries)
7. [Pricing & Costs](#pricing--costs)
8. [Examples](#examples)
9. [Known Issues & Limitations](#known-issues--limitations)

## Overview

The Gemini API is Google's powerful generative AI API that provides access to advanced language models with multimodal capabilities. The REST API allows direct HTTP access without requiring language-specific SDKs.

### Available Platforms
- **Google AI Studio**: For prototyping and development
- **Vertex AI on Google Cloud**: For production use

### Key Features
- Multimodal support (text, images, audio, video)
- Thinking models with reasoning capabilities
- Structured JSON output
- Streaming responses
- Multi-turn conversations

## Authentication

### Google AI Studio (Development)
Use API key authentication:
```bash
API_KEY="your-api-key-here"
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}"
```

### Vertex AI (Production)
Use OAuth 2.0 with Google Cloud credentials:
```bash
ACCESS_TOKEN=$(gcloud auth print-access-token)
curl -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent"
```

## REST API Endpoints

### Google AI Studio Endpoints
```
# Generate content
https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}

# Stream generate content  
https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent?key={API_KEY}

# Count tokens
https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:countTokens?key={API_KEY}
```

### Available Models
- `gemini-2.5-flash` - Fast, efficient model with thinking support
- `gemini-2.5-pro` - Advanced model with deep reasoning
- `gemini-2.0-flash-thinking-exp` - Experimental thinking model
- `gemini-1.5-flash` - Previous generation
- `gemini-1.5-pro` - Previous generation pro model

## Thinking Models

Thinking models use chain-of-thought reasoning to work through complex problems before providing answers.

### Supported Thinking Models
- `gemini-2.5-flash`
- `gemini-2.5-pro`
- `gemini-2.0-flash-thinking-exp`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-2.0-flash-thinking-exp-1219`
- `gemini-exp-1206`

### Thinking Configuration
```json
{
  "generationConfig": {
    "thinkingConfig": {
      "thinkingBudget": -1,      // -1 for dynamic, 0 to disable, or specific token count
      "includeThoughts": true    // Include thought summaries in response
    }
  }
}
```

#### Thinking Budget Options
- **-1**: Dynamic allocation (model decides)
- **0**: Disable thinking
- **1-24576**: Specific token budget
- **Default**: 8192 tokens

## Request & Response Format

### Basic Request Structure
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Your prompt here"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 65536,
    "topP": 1.0,
    "seed": 42
  }
}
```

### Request with Thinking Enabled
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Solve this complex math problem: Find all prime numbers between 1 and 100"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.0,
    "maxOutputTokens": 65536,
    "thinkingConfig": {
      "thinkingBudget": 2048,
      "includeThoughts": true
    },
    "responseMimeType": "application/json"
  }
}
```

### Response Structure
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Let me work through finding all prime numbers between 1 and 100...",
            "thought": true
          },
          {
            "text": "The prime numbers between 1 and 100 are: 2, 3, 5, 7, 11, 13...",
            "thought": false
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE",
          "blocked": false
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 15,
    "candidatesTokenCount": 250,
    "thoughtsTokenCount": 1024,
    "totalTokenCount": 1289
  }
}
```

## Thought Summaries

Thought summaries are synthesized versions of the model's reasoning process, providing insight into how the model arrived at its answer.

### Accessing Thought Summaries
```javascript
// JavaScript example
for (const part of response.candidates[0].content.parts) {
  if (part.thought) {
    console.log("Model's thinking:", part.text);
  } else {
    console.log("Final answer:", part.text);
  }
}
```

### Key Points
- Thought summaries are abbreviated versions of raw thoughts
- They provide structured insight with headers and key details
- Raw thoughts are not exposed via API (only summaries)
- Summaries help with debugging and understanding model reasoning

## Pricing & Costs

### Thinking Token Costs
**Important**: You pay for the full thought tokens generated, not just the summary.

#### Gemini 2.5 Flash Pricing
- **Input**: $0.15 per million tokens
- **Output (thinking OFF)**: $0.60 per million tokens  
- **Output (thinking ON)**: $3.50 per million tokens (nearly 6x increase)

#### Cost Management Strategies
1. Use lower thinking budgets for simple tasks
2. Disable thinking for straightforward queries
3. Monitor `thoughtsTokenCount` in responses
4. Use dynamic allocation wisely

### Billing Notes
- Failed requests (400/500 errors) aren't charged
- Thinking tokens count toward total usage
- Free tier available with rate limits
- Pay-as-you-go pricing for production use

## Examples

### Example 1: Simple Text Generation
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Write a haiku about programming"
      }]
    }]
  }'
```

### Example 2: Complex Reasoning with Thinking
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Explain the solution to the traveling salesman problem for 5 cities"
      }]
    }],
    "generationConfig": {
      "thinkingConfig": {
        "thinkingBudget": 4096,
        "includeThoughts": true
      }
    }
  }'
```

### Example 3: Structured JSON Output
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "List 3 programming languages with their key features"
      }]
    }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": {
        "type": "ARRAY",
        "items": {
          "type": "OBJECT",
          "properties": {
            "language": {"type": "STRING"},
            "features": {
              "type": "ARRAY",
              "items": {"type": "STRING"}
            },
            "yearCreated": {"type": "INTEGER"}
          },
          "required": ["language", "features"]
        }
      }
    }
  }'
```

### Example 4: Backend Proxy Implementation
```typescript
// TypeScript/Node.js backend proxy example
async function callGeminiWithThinking(prompt: string, model: string = 'gemini-2.5-flash') {
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 65536,
      thinkingConfig: {
        thinkingBudget: -1,  // Dynamic allocation
        includeThoughts: true
      }
    }
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const data = await response.json();
  
  // Process parts to separate thoughts from answers
  const thoughts = [];
  const answers = [];
  
  for (const part of data.candidates[0].content.parts) {
    if (part.thought) {
      thoughts.push(part.text);
    } else {
      answers.push(part.text);
    }
  }
  
  return {
    thoughts,
    answers,
    tokenUsage: data.usageMetadata
  };
}
```

## Known Issues & Limitations

### Current Limitations
1. **Multi-turn Context**: Thinking context not preserved across turns in stateless API
2. **Raw Thoughts**: Only summaries available, not raw thinking process
3. **SDK Support**: Some SDKs don't fully support thinking config yet
4. **Streaming**: Thought summaries may not stream properly

### Reported Issues (as of July 2025)
- Intermittent issues with thoughts not being included even when `includeThoughts: true`
- Some users report thoughts only visible in Google AI Studio, not API
- Streaming responses may not include thought parts properly

### Best Practices
1. Always check for `thought` boolean when processing parts
2. Handle cases where thoughts might be missing
3. Monitor token usage to control costs
4. Use appropriate thinking budgets for task complexity
5. Test thoroughly as the feature is still evolving

### Debugging Tips
```javascript
// Always log the full response structure for debugging
console.log(JSON.stringify(response, null, 2));

// Check if thoughts were actually included
const hasThoughts = response.candidates[0].content.parts.some(part => part.thought);
console.log('Response includes thoughts:', hasThoughts);

// Monitor token usage
console.log('Thinking tokens used:', response.usageMetadata?.thoughtsTokenCount || 0);
```

## Summary

The Gemini REST API with thinking models provides powerful reasoning capabilities for complex tasks. While the feature adds significant cost (up to 6x for output tokens), it enables sophisticated problem-solving and transparent AI reasoning. Developers should carefully manage thinking budgets and monitor token usage to balance performance with cost efficiency.

For the latest updates and detailed API reference, visit:
- [Google AI for Developers](https://ai.google.dev/gemini-api/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs)