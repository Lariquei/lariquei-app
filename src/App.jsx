import React, { useState } from 'react'
import { supabase } from './lib/supabaseClient'

export default function App() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')

  async function testSupabase() {
    const { data, error } = await supabase.from('favoritos').select('*')
    if (error) alert('Erro Supabase: ' + error.message)
    else alert('Conexão OK: ' + data.length + ' registros')
  }

  async function testAI() {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: message })
    })
    const data = await res.json()
    setResponse(data?.choices?.[0]?.message?.content || 'Sem resposta')
  }

  return (
    <div style={{ padding: 32 }}>
      <h1>Teste Supabase + OpenAI</h1>
      <button onClick={testSupabase}>Testar Supabase</button>

      <div style={{ marginTop: 24 }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Pergunte algo"
          style={{ width: 300 }}
        />
        <button onClick={testAI}>Enviar à IA</button>
      </div>

      {response && (
        <div style={{ marginTop: 24 }}>
          <h3>Resposta:</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  )
}
