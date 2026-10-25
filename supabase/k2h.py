# 일본 고교 이름 가나 → 한글 (jp_schools.name_ko 만들 때 씀) (현지 발음: 장음은 적지 않고(そう→소, しゅう→슈), か·た행은 거센소리(카·타), すん→순)
import sys
CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"; JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"; JONG = ["", "ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]
def syl(c, v, j=""): return chr(0xAC00 + (CHO.index(c) * 21 + JUNG.index(v)) * 28 + JONG.index(j))
V = {"a": "ㅏ", "i": "ㅣ", "u": "ㅜ", "e": "ㅔ", "o": "ㅗ"}
ROW = {"": "ㅇ", "k": "ㅋ", "g": "ㄱ", "s": "ㅅ", "z": "ㅈ", "t": "ㅌ", "d": "ㄷ", "n": "ㄴ", "h": "ㅎ", "b": "ㅂ", "p": "ㅍ", "m": "ㅁ", "y": "ㅇ", "r": "ㄹ", "w": "ㅇ", "f": "ㅍ"}
K = {}
for row, chars in [("", "あいうえお"), ("k", "かきくけこ"), ("g", "がぎぐげご"), ("s", "さしすせそ"), ("z", "ざじずぜぞ"), ("t", "たちつてと"), ("d", "だぢづでど"), ("n", "なにぬねの"), ("h", "はひふへほ"), ("b", "ばびぶべぼ"), ("p", "ぱぴぷぺぽ"), ("m", "まみむめも"), ("r", "らりるれろ")]:
    for ch, v in zip(chars, "aiueo"): K[ch] = (ROW[row], V[v])
K.update({"や": ("ㅇ", "ㅑ"), "ゆ": ("ㅇ", "ㅠ"), "よ": ("ㅇ", "ㅛ"), "わ": ("ㅇ", "ㅘ"), "を": ("ㅇ", "ㅗ"),
  "し": ("ㅅ", "ㅣ"), "ち": ("ㅊ", "ㅣ"), "つ": ("ㅊ", "ㅡ"), "す": ("ㅅ", "ㅡ"), "ず": ("ㅈ", "ㅡ"), "づ": ("ㅈ", "ㅡ"), "じ": ("ㅈ", "ㅣ"), "ぢ": ("ㅈ", "ㅣ"), "ふ": ("ㅎ", "ㅜ")})
Y = {"ゃ": "ㅑ", "ゅ": "ㅠ", "ょ": "ㅛ"}
SMALLV = {"ぁ": "ㅏ", "ぃ": "ㅣ", "ぅ": "ㅜ", "ぇ": "ㅔ", "ぉ": "ㅗ"}
def k2h(s, long=False):
    s = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
    out = []  # [cho, jung, jong]
    i = 0
    while i < len(s):
        c = s[i]; n = s[i + 1] if i + 1 < len(s) else ""
        if c in "・ 　": out.append(" "); i += 1; continue
        if c == "ん":
            if out and isinstance(out[-1], list): out[-1][2] = "ㄴ"
            i += 1; continue
        if c == "っ":
            if out and isinstance(out[-1], list): out[-1][2] = "ㅅ"
            i += 1; continue
        if c == "ー": i += 1; continue
        if c not in K: out.append(c); i += 1; continue
        # 장음은 적지 않음: お단+う/お (そう→소), う단+う (しゅう→슈), い+い (にい→니)
        if not long and out and isinstance(out[-1], list) and not out[-1][2]:
            pv = out[-1][1]
            if (c in "うお" and pv in "ㅗㅛ") or (c == "う" and pv in "ㅜㅠ") or (c == "い" and pv == "ㅣ" and out[-1][0] != "ㅇ"):
                i += 1; continue
        cho, jung = K[c]
        if n in Y:
            cho = {"ㅅ": "ㅅ", "ㅊ": "ㅊ", "ㅈ": "ㅈ"}.get(cho, cho)
            jung = Y[n] if cho not in "ㅅㅊㅈ" else {"ㅑ": "ㅏ", "ㅠ": "ㅜ", "ㅛ": "ㅗ"}[Y[n]]
            if c == "し": jung = Y[n]  # しゃ 샤 しゅ 슈 しょ 쇼
            i += 1
        elif n in SMALLV:  # うぇ 웨, ふぁ 파, てぃ 티
            jung = {"ㅇ": {"ㅔ": "ㅞ", "ㅣ": "ㅟ", "ㅏ": "ㅘ", "ㅗ": "ㅝ"}}.get(cho, {}).get(SMALLV[n], SMALLV[n]); i += 1
            if cho == "ㅎ": cho = "ㅍ"
        # すん·ずん·つん → 순·준·춘
        if jung == "ㅡ" and (s[i + 1:i + 2] == "ん"): jung = "ㅜ"
        out.append([cho, jung, ""]); i += 1
    return "".join(syl(*x) if isinstance(x, list) else x for x in out)
if __name__ == "__main__":
    for w in sys.argv[1:]: print(w, k2h(w))
