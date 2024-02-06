import { AstraDB } from "@datastax/astra-db-ts";
import OpenAI from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat";
import { CATEGORIES } from "../../../utils/consts";

const {
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_API_ENDPOINT,
  OPENAI_API_KEY,
} = process.env;

console.log("ASTRA_DB_APPLICATION_TOKEN", ASTRA_DB_APPLICATION_TOKEN);
console.log("ASTRA_DB_API_ENDPOINT", ASTRA_DB_API_ENDPOINT);
console.log("OPENAI_API_KEY", OPENAI_API_KEY);

const astraDb = new AstraDB("AstraCS:rUOTotZYumAyTdoHOYZHgZuG:ccf9d08f6dd51be6a152022c97a18d3e79e44d9912f45a1416735a33d640c0b4", "https://a870a5c5-cffb-46a2-9dbd-88db7f2dc81a-us-east-1.apps.astra.datastax.com");

const openai = new OpenAI({
  apiKey: "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",
});

export async function POST(req: Request) {
  try {
    let docContext = "";

    try {
      const suggestionsCollection = await astraDb.collection("article_suggestions");

      const suggestionsDoc = await suggestionsCollection.findOne(
        {
          _id: "recent_articles"
        },
        {
          projection: {
            "recent_articles.metadata.title" : 1,
            "recent_articles.suggested_chunks.content" : 1,
          },
        });

      const docMap = suggestionsDoc.recent_articles.map(article => {
        return {
          pageTitle: article.metadata.title,
          content: article.suggested_chunks.map(chunk => chunk.content)
        }
      });

      docContext = JSON.stringify(docMap);
    } catch (e) {
      console.log("Error querying db...");
    }


    const functions: ChatCompletionCreateParams.Function[] = [

      {
        name: 'get_suggestion_and_category',
        description: 'Prints a suggested question and the category it belongs to.',
        parameters: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              description: 'The suggested questions and their categories.',
              items: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    enum: CATEGORIES,
                    description: 'The category of the suggested question.',
                  },
                  question: {
                    type: 'string',
                    description:
                      'The suggested question.',
                  },
                },
              },
            },
          },
          required: ['questions'],
        },
      },
    ];

    const response = await openai.chat.completions.create(
      {
        model: "gpt-3.5-turbo-16k",
        temperature: 1,
        messages: [{
          role: "user",
          content: `You are an assistant who creates sample questions to ask a chatbot.
          Given the context below of the most recently added data to the most popular pages on Wikipedia come up with 4 suggested questions
          Only write no more than one question per page and keep them to less than 12 words each
          Do not label which page the question is for/from

          START CONTEXT
          ${docContext}
          END CONTEXT
          `,
        }],
        functions
      }
    );

    return new Response(response.choices[0].message.function_call.arguments);
  } catch (e) {
    throw e;
  }
}
