export async function chatStream(query: string, top_k = 6, signal?: AbortSignal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ query, top_k }),
    signal
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  return {
    async *iter() {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield decoder.decode(value);
      }
    }
  };
}
