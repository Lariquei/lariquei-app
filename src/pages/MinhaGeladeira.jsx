// src/pages/MinhaGeladeira.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient' // ajuste o caminho se necessário

// Se você tiver uma util util/createPageUrl, importe-a; caso contrário fallback:
let createPageUrl = null
try {
  // eslint-disable-next-line
  createPageUrl = require('../utils').createPageUrl
} catch (e) {
  createPageUrl = null
}

export default function MinhaGeladeira() {
  const [ingredientes, setIngredientes] = useState([])
  const [novoIngrediente, setNovoIngrediente] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [user, setUser] = useState(null)
  const isInitialMount = useRef(true)
  const navigate = useNavigate()

  // Carrega usuário e geladeira do Supabase
  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user) {
        // usuário não logado → redirecionar para login (se quiser)
        // você pode implementar um fluxo de login aqui ou apenas deixar usuário nulo
        setUser(null)
        return
      }
      const u = authData.user
      if (!mounted) return
      setUser(u)

      // buscar geladeira do usuário
      const { data, error } = await supabase
        .from('geladeiras')
        .select('ingredientes')
        .eq('user_id', u.id)
        .maybeSingle() // retorna single ou null
      if (error) {
        console.error('Erro ao buscar geladeira:', error)
      } else if (data && data.ingredientes) {
        setIngredientes(Array.isArray(data.ingredientes) ? data.ingredientes : [])
      } else {
        setIngredientes([]) // padrão
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Persistir alterações (upsert)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (!user) return
    // grava com debounce mínimo (pode melhorar)
    const t = setTimeout(async () => {
      const payload = { user_id: user.id, ingredientes: ingredientes }
      const { error } = await supabase.from('geladeiras').upsert(payload, { onConflict: 'user_id' })
      if (error) console.error('Erro ao salvar geladeira:', error)
    }, 300)
    return () => clearTimeout(t)
  }, [ingredientes, user])

  // Speech recognition setup (browser)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = 'pt-BR'

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase()
        setNovoIngrediente(transcript)
        setIsListening(false)
      }

      recognitionInstance.onerror = (event) => {
        console.error('Erro no reconhecimento de voz:', event.error)
        setIsListening(false)
      }

      recognitionInstance.onend = () => setIsListening(false)

      setRecognition(recognitionInstance)
    }
  }, [])

  const adicionarIngrediente = () => {
    const val = novoIngrediente.trim().toLowerCase()
    if (val && !ingredientes.includes(val)) {
      setIngredientes(prev => [...prev, val])
      setNovoIngrediente('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      adicionarIngrediente()
    }
  }

  const removerIngrediente = (ingredienteParaRemover) => {
    setIngredientes(prev => prev.filter(ing => ing !== ingredienteParaRemover))
  }

  const startListening = () => {
    if (!recognition) return
    try {
      setIsListening(true)
      recognition.start()
    } catch (error) {
      console.error('Erro ao iniciar reconhecimento:', error)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (!recognition) return
    try {
      recognition.stop()
      setIsListening(false)
    } catch (error) {
      console.error('Erro ao parar reconhecimento:', error)
    }
  }

  const buscarReceitas = () => {
    if (ingredientes.length === 0) return
    const ingredientesQuery = encodeURIComponent(ingredientes.join(','))
    if (createPageUrl) {
      navigate(createPageUrl(`Receitas?ingredientes=${ingredientesQuery}`))
    } else {
      navigate(`/receitas?ingredientes=${ingredientesQuery}`)
    }
  }

  const esvaziarGeladeira = () => setIngredientes([])

  if (user === null) {
    // usuário não autenticado ou carregando
    return <div className="text-center py-20">Carregando... (faça login para salvar sua geladeira)</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Minha Geladeira</h1>
        <p className="text-lg text-gray-600">Liste os ingredientes que você tem em casa para descobrir receitas!</p>
      </div>

      <div className="border-2 border-gray-200 rounded-xl bg-white p-4">
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder={isListening ? "Ouvindo..." : "Ex: frango, batata..."}
              value={novoIngrediente}
              onChange={(e) => setNovoIngrediente(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-3 pr-12 h-12 text-lg rounded-xl border-2 focus:border-yellow-400 w-full"
              disabled={isListening}
            />
            {recognition && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isListening ? 'text-red-500 bg-red-50' : 'text-gray-600 hover:text-gray-800'}`}
                type="button"
              >
                {isListening ? 'Parar' : '🎤'}
              </button>
            )}
          </div>
          <button onClick={adicionarIngrediente} className="h-12 w-12 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-bold">+</button>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={buscarReceitas}
          disabled={ingredientes.length === 0}
          className="h-14 px-10 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-full disabled:opacity-50"
        >
          Buscar Receitas
        </button>
      </div>

      <div className="mt-8">
        {ingredientes.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700">Sua lista de ingredientes:</h3>
              <button onClick={esvaziarGeladeira} className="text-red-500 hover:text-red-600">Esvaziar</button>
            </div>
            <div className="flex flex-wrap gap-3">
              {ingredientes.map(ing => (
                <div
                  key={ing}
                  className="flex items-center gap-2 bg-white border-2 border-orange-500 text-orange-600 font-semibold px-4 py-2 rounded-full cursor-pointer hover:bg-orange-50"
                  onClick={() => removerIngrediente(ing)}
                >
                  <span className="capitalize">{ing}</span>
                  <span className="opacity-70">✕</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 text-yellow-800 rounded-xl p-4 mt-8 text-sm">
        <div className="text-yellow-500">💡</div>
        <p className="text-justify">
          <b>Dica:</b> Use o microfone para adicionar ingredientes por voz ou digite normalmente! Quanto mais ingredientes você adicionar, melhores serão os resultados.
        </p>
      </div>
    </div>
  )
}
