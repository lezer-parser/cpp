import {ExternalTokenizer} from "lezer"
import {rawStringStart, rawStringEnd, rawStringContent, templateArgsEndFallback, MacroName} from "./parser.terms.js"

const R = 82, L = 76, u = 117, U = 85,
      a = 97, z = 122, A = 65, Z = 90, Underscore = 95,
      Zero = 48,
      Quote = 34,
      ParenL = 40, ParenR = 41,
      Space = 32, Newline = 10,
      GreaterThan = 62

export const rawString = new ExternalTokenizer((input, token) => {
  let pos = token.start, next = input.get(pos++)
  // Raw string literals can start with: R, LR, uR, UR, u8R
  if (next == L || next == U) {
    next = input.get(pos++)
  } else if (next == u) {
    next = input.get(pos++)
    if (next == Zero + 8) next = input.get(pos++)
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
        if (!match) return
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

export const fallback = new ExternalTokenizer((input, token) => {
  let pos = token.start, next = input.get(pos)
  if (next == GreaterThan) {
    // Provide a template-args-closing token when the next characters
    // are ">>", in which case the regular tokenizer will only see a
    // bit shift op.
    if (input.get(pos + 1) == GreaterThan)
      token.accept(templateArgsEndFallback, pos + 1)
  } else {
    // Notice all-uppercase identifiers
    let sawLetter = false
    for (;; next = input.get(++pos)) {
      if (next >= A && next <= Z) sawLetter = true
      else if (next >= a && next <= z) return
      else if (next != Underscore && !(next >= Zero && next <= Zero + 9)) break
    }
    if (sawLetter && pos >= token.start + 2) token.accept(MacroName, pos)
  }
}, {extend: true})
