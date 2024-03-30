import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import CreatorView from "database/entities/creator-view.entity";
import { creatorResponseSpec } from "dtos/creator.dto";
import { Response } from "express";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

export const createDocumentFromCreator = (creators: CreatorView[]) => {
  const documents: Document[] = [];
  for (const c of creators) {
    const creator = creatorResponseSpec(c);
    const document = new Document({
      pageContent: JSON.stringify(creator),
      metadata: {
        id: creator.id,
        uniqueId: creator.uniqueId,
        nickName: creator.nickName,
      },
    });
    documents.push(document);
  }

  return documents;
};

export const createVectorStore = async (documents: Document[]) => {
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings,
  );

  return vectorStore;
};

export const searchRelevantCreators = async (
  res: Response,
  creators: CreatorView[],
  {
    objective,
    product,
    category,
    targetAudience,
    timeline,
    industry,
  }: {
    objective: string;
    product: string;
    category: string;
    targetAudience: string;
    timeline: string;
    industry: string | undefined;
  },
) => {
  const documents = createDocumentFromCreator(creators);
  res.write("step: parsing-influencer\n");
  const vectorStore = await createVectorStore(documents);
  const weeksInTimeline = timeline.split("_")[0];
  let k = 1;
  if (weeksInTimeline === "ONE") {
    k = 1;
  } else if (weeksInTimeline === "TWO") {
    k = 2;
  } else if (weeksInTimeline === "THREE") {
    k = 3;
  } else if (weeksInTimeline === "FOUR") {
    k = 4;
  }
  const retriever = vectorStore.asRetriever({
    k,
  });

  const prompt =
    ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`);
  const model = new ChatOpenAI({});
  const documentChain = await createStuffDocumentsChain({
    llm: model,
    prompt,
  });

  const retrievalChain = await createRetrievalChain({
    combineDocsChain: documentChain,
    retriever,
  });

  const result = await retrievalChain.stream({
    input: `Buatkan saya campaign plan untuk produk susu anak yang bertujuan untuk meningkatkan engagement. Berikut adalah detail campaign plan yang saya butuhkan:
    Objective : ${objective}
    Produk : ${product}
    Kategori : ${category}
    Target Audience : ${targetAudience}
    Timeline : ${k} Minggu
    ${industry ? `Industri : ${industry}` : ""}

    Berikan saya campaign plan yang detail dan menarik.
    BERIKAN OUTPUT CAMPAIGN SESUAI DENGAN OBJECTIVE, TARGET AUDIENCE YANG DITENTUKAN DENGAN FORMAT :
    Minggu 1:
    - Content
    - Influencer: Nama Influencer (@ dengan uniqueId)
    - Description

    Dan seterusnya selama ${k} Minggu. (JANGAN LUPA UNTUK MENGHUBUNGKAN DENGAN OBJECTIVE DAN TARGET AUDIENCE YANG DITENTUKAN)

    BERIKAN OUTPUT DALAM BAHASA INDONESIA DAN FORMAT YANG JELAS DAN DETAIL.
      `,
  });

  let response = "";
  for await (const chunk of result) {
    if (chunk.answer) {
      response += chunk.answer;
      res.write(chunk.answer);
    }
    if (chunk.context) {
      res.write(`context: ${chunk.context}\n`);
    }
  }

  return response;
};
