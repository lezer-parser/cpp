import {ExternalTokenizer} from "lezer"
import {rawStringStart, rawStringEnd, rawStringContent} from "./parser.terms.js"

const R = 82, L = 76, u = 117, U = 85,
      _8 = 56,
      Quote = 34,
      ParenL = 40, ParenR = 41,
      Space = 32, Newline = 10

export const rawString = new ExternalTokenizer((input, token) => {
  let pos = token.start, next = input.get(pos++)
  // Raw string literals can start with: R, LR, uR, UR, u8R
  if (next == L || next == U) {
    next = input.get(pos++)
  } else if (next == u) {
    next = input.get(pos++)
    if (next == _8) next = input.get(pos++)
  }
  if (next != R) return
  next = input.get(pos++)
  if (next != Quote) return
  next = input.get(pos++)

  while (next != ParenL) {
    if (next == Space || next <= 13 || next == ParenR) return
    next = input.get(pos++)
  }

  return token.accept(rawStringStart, pos)
})

export const rawStringContinue = new ExternalTokenizer((input, token, stack) => {
  let pos = token.start, next = input.get(pos++), markerString = null
  for (;;) {
    if (next < 0) {
      if (pos > token.start + 1) token.accept(rawStringContent, pos - 1)
      return
    } else if (next == ParenR) {
      if (!markerString) {
        let ruleStart = stack.ruleStart
        let match = /"(\S*?)\(/.exec(input.read(ruleStart, Math.min(token.start, ruleStart + 100)))
        markerString = match[1] + '"'
      }
      if (input.read(pos, pos + markerString.length) == markerString) {
        token.accept(rawStringEnd, pos + markerString.length)
        return
      }
    } else if (next == Newline) {
      token.accept(rawStringContent, pos)
      return
    }
    next = input.get(pos++)
  }
}, {contextual: true})
