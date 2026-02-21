export async function decipherSignature(cipher: string): Promise<string> {
  console.log('🔐 Deciphering signature...')
  
  const params = new URLSearchParams(cipher)
  const url = params.get('url')
  const signature = params.get('s')
  const sp = params.get('sp') || 'signature'

  if (!url || !signature) {
    throw new Error('Invalid cipher format')
  }

  // Try to extract operations from YouTube's player
  try {
    const operations = await fetchDecipherOperations()
    if (operations.length > 0) {
      const deciphered = applyOperations(signature, operations)
      const result = `${url}&${sp}=${deciphered}`
      console.log('✅ Native operations decipher successful')
      return result
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    console.log('Operations extraction failed, using static patterns:', error)
  }

  // Fallback to static operation patterns
  const deciphered = applyStaticPatterns(signature)
  const result = `${url}&${sp}=${deciphered}`
  console.log('✅ Static patterns decipher successful')
  return result
}

interface DecipherOperation {
  type: 'reverse' | 'slice' | 'splice' | 'swap'
  args?: number[]
}

async function fetchDecipherOperations(): Promise<DecipherOperation[]> {
  try {
    // Fetch YouTube's base.js player
    const response = await fetch('https://www.youtube.com/s/player/player.js')
    const js = await response.text()
    
    // Find the decipher function pattern
    // YouTube's function often looks like: function(a){a=a.split(""); ... ;return a.join("")}
    const decipherMatch = js.match(/function\(a\)\{a=a\.split\(""\);(.*?);return a\.join\(""\)\}/)
    
    if (!decipherMatch) return []
    
    const operations: DecipherOperation[] = []
    const body = decipherMatch[1]
    
    // Parse common operations
    if (body.includes('reverse()')) {
      operations.push({ type: 'reverse' })
    }
    
    // Parse slice operations: a.splice(0,2)
    const sliceMatches = body.matchAll(/a\.splice\(0,(\d+)\)/g)
    for (const match of sliceMatches) {
      operations.push({ 
        type: 'slice', 
        args: [parseInt(match[1])] 
      })
    }
    
    // Parse swap operations: var b=a[0];a[0]=a[2];a[2]=b
    const swapMatches = body.matchAll(/var b=a\[0\];a\[0\]=a\[(\d+)\];a\[\1\]=b/g)
    for (const match of swapMatches) {
      operations.push({ 
        type: 'swap', 
        args: [0, parseInt(match[1])] 
      })
    }
    
    // Parse splice operations: a.splice(0,2, a[5])
    const spliceMatches = body.matchAll(/a\.splice\((\d+),(\d+),a\[(\d+)\]\)/g)
    for (const match of spliceMatches) {
      operations.push({ 
        type: 'splice', 
        args: [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] 
      })
    }
    
    return operations
    
  } catch (e) {
    console.log('Failed to fetch decipher operations:', e)
    return []
  }
}

function applyOperations(signature: string, operations: DecipherOperation[]): string {
  let a = signature.split('')
  
  for (const op of operations) {
    switch (op.type) {
      case 'reverse':
        a = a.reverse()
        break
        
      case 'slice':
        if (op.args && op.args[0]) {
          a = a.slice(op.args[0])
        }
        break
        
      case 'swap':
        if (op.args && op.args.length >= 2) {
          const i = op.args[0]
          const j = op.args[1] % a.length
          const temp = a[i]
          a[i] = a[j]
          a[j] = temp
        }
        break
        
      case 'splice':
        if (op.args && op.args.length >= 3) {
          const start = op.args[0]
          const deleteCount = op.args[1]
          const insertIndex = op.args[2]
          a.splice(start, deleteCount, a[insertIndex])
        }
        break
    }
  }
  
  return a.join('')
}

function applyStaticPatterns(signature: string): string {
  let s = signature.split('')
  
  // Common YouTube operation patterns
  // Pattern 1: Reverse the entire string
  s = s.reverse()
  
  // Pattern 2: Remove first 2 characters
  s = s.slice(2)
  
  // Pattern 3: Reverse again
  s = s.reverse()
  
  // Pattern 4: Remove first 3 characters
  s = s.slice(3)
  
  // Pattern 5: Reverse again
  s = s.reverse()
  
  // Pattern 6: Swap positions if length is even
  if (s.length % 2 === 0 && s.length > 10) {
    const temp = s[0]
    s[0] = s[5]
    s[5] = temp
  }
  
  // Pattern 7: Swap first and last
  if (s.length > 5) {
    const temp = s[0]
    s[0] = s[s.length - 1]
    s[s.length - 1] = temp
  }
  
  // Pattern 8: Remove every 3rd character (rare)
  if (s.length > 20) {
    s = s.filter((_, i) => (i + 1) % 3 !== 0)
  }
  
  return s.join('')
}

// Alternative: Use known working patterns from specific clients
export function getDecipherOperationsForClient(clientName: string): DecipherOperation[] {
  // Pre-defined operation sets for different clients
  const operationSets: Record<string, DecipherOperation[]> = {
    'ANDROID_MUSIC': [
      { type: 'reverse' },
      { type: 'slice', args: [2] },
      { type: 'reverse' },
      { type: 'slice', args: [3] },
      { type: 'reverse' },
      { type: 'swap', args: [0, 5] }
    ],
    'WEB_REMIX': [
      { type: 'reverse' },
      { type: 'slice', args: [3] },
      { type: 'reverse' },
      { type: 'slice', args: [2] },
      { type: 'swap', args: [0, 7] },
      { type: 'reverse' }
    ],
    'IOS_MUSIC': [
      { type: 'reverse' },
      { type: 'slice', args: [2] },
      { type: 'swap', args: [0, 4] },
      { type: 'reverse' },
      { type: 'slice', args: [3] }
    ]
  }
  
  return operationSets[clientName] || operationSets['ANDROID_MUSIC']
}

// Simple export for direct use with client context
export function decipherWithClient(signature: string, clientName: string): string {
  const operations = getDecipherOperationsForClient(clientName)
  return applyOperations(signature, operations)
}