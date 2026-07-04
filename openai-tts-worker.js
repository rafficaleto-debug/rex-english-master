// レックス英語マスター v75.1
// この版ではOpenAI/Cloudflare Workerは使いません。
// v74とのファイル構成互換のために、このファイル名だけ残しています。
// GitHub上に残っていてもアプリ本体からは読み込まれません。
export default {
  async fetch() {
    return new Response(JSON.stringify({
      ok: true,
      message: 'v75.1 uses Kokoro TTS. OpenAI worker is not required.'
    }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
};
