const { Configuration, OpenAIApi } = require("openai");
const axios = require("axios");
const crypto = require("crypto");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getAssistantResponse(userMessage) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error getting assistant response:", error);
    return "抱歉，目前無法回應您的問題。";
  }
}

function validateSignature(body, signature) {
  const hash = crypto
    .createHmac("sha256", process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

module.exports = async (req, res) => {
  const signature = req.headers["x-line-signature"];
  
  // 檢查簽名是否有效
  if (!validateSignature(JSON.stringify(req.body), signature)) {
    return res.status(403).send("Forbidden");
  }

  if (req.method === "POST") {
    const event = req.body.events[0];
    const userMessage = event.message.text;

    // 調用 OpenAI Assistant
    const assistantResponse = await getAssistantResponse(userMessage);

    // 回覆訊息至 LINE
    try {
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [{ type: "text", text: assistantResponse }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
        }
      );
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error sending message to LINE:", error);
      res.status(500).send("Error");
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
