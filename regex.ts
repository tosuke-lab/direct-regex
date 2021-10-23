// 正規表現をε付きNFAと解釈して遷移

const reg = "^((a|b)*c(a|b)*c)*(a|b)*$";
console.log(`/${reg}/`);

const r = createRegex(reg);
console.log(r);

for (const input of ["bcca"]) {
  console.log(`"${input}"`, "->", matchString(r, input));
}

export interface DirectRegex {
  readonly regex: readonly string[];
  readonly index: readonly number[];
}

function createRegex(regexString: string): DirectRegex {
  const regex = [..."^?", ...regexString, ..."$"];
  const index = Array.from<number>({ length: regex.length }).fill(-1);

  const dr: DirectRegex = { regex, index };

  // 括弧に関するindexを生成する
  const stack: number[] = [];
  for (let i = 0; i < regex.length; i++) {
    if (regex[i] === "(") {
      stack.push(i);
      continue;
    }
    if (regex[i] === ")") {
      const j = stack.pop()!;
      index[i] = j;
      index[j] = i;
      continue;
    }
  }

  // "|"に関するindexを生成する
  // 正規表現を後ろから読み、|{r1}{r2} というパターンに対して、r2!=|ならr2の位置を、r2==|ならindex[r2]の値を入れる
  for (let i = regex.length - 1; i > 0; i--) {
    if (regex[i] !== "|") continue;

    let r2 = nextSymbol(dr, nextSymbol(dr, i));
    // 記号は飛ばす
    if ("?*+".includes(regex[r2])) r2++;

    index[i] = regex[r2] === "|" ? index[r2] : r2;
  }

  return dr;
}

/**
 * 次のvalidな記号の先頭位置
 */
function nextSymbol({ regex, index }: DirectRegex, s: number) {
  if (s >= regex.length || 0 > s) return -1;
  if (regex[s] === "(") {
    return index[s] + 1;
  }
  return s + 1;
}

/**
 * 前のvalidな記号の先頭位置
 */
function prevSymbol({ regex, index }: DirectRegex, s: number) {
  if (regex[s - 1] === ")") {
    return index[s - 1];
  }
  return s - 1;
}

/**
 * ε以外の状態遷移
 */
function nextState(r: DirectRegex, s: number, char: string) {
  const { regex, index } = r;

  let next: number;
  const sym = regex[s];
  switch (sym) {
    // 非マッチ文字
    case "(":
    case ")":
    case "|":
    case "*":
    case "+":
    case "?":
      return -1;
    // 開始
    case "^":
      if (char !== "^^") return -1;
      next = s + 1;
      break;
    // 終端
    case "$":
      if (char !== "$$") return -1;
      next = regex.length - 1;
      break;
    // 任意
    case ".":
      if (char === "^^" || char === "$$") return -1;
      next = s + 1;
      break;
    // 通常文字マッチ
    default:
      if (char !== sym) return -1;
      next = s + 1;
      break;
  }
  // マッチ成功後、その後方にあって確実に読み飛ばしてよいものを読み飛ばす
  while (true) {
    switch (regex[next]) {
      case "?":
      case ")":
        next++;
        continue;
      case "|":
        // index[next] > 0
        next = index[next];
        continue;
      default:
        return next;
    }
  }
}

/**
 * 集合の遷移
 */
function nextStateSet(r: DirectRegex, stateSet: Set<number>, char: string) {
  const { regex } = r;
  // stateSetのそれぞれの要素からからε-動作で行ける状態を幅優先で探索し、その全てで通常遷移を行って到達できる状態の集合を求める
  const result = new Set<number>();
  for (const state0 of stateSet) {
    const queue: number[] = [state0];
    let state: number | undefined;
    while (((state = queue.shift()), state != null)) {
      const next = nextState(r, state, char);
      if (next > 0) result.add(next);

      // ループ遷移
      if ("+*".includes(regex[state])) {
        queue.push(prevSymbol(r, state));
      }

      // 記号を読み飛ばして進む遷移
      if ("()?+*".includes(regex[state])) {
        queue.push(state + 1);
      }

      // 先読みして文字消費なしで進む遷移
      let nextPos = nextSymbol(r, state);

      if ("?*".includes(regex[nextPos])) {
        queue.push(nextPos + 1);
      }

      // 選言
      if ("?+*".includes(regex[nextPos])) nextPos++; //記号があったら飛ばす
      if (regex[nextPos] === "|") {
        queue.push(nextPos + 1);
      }
    }
  }
  console.log(char, result);
  return result;
}

function matchString(r: DirectRegex, str: string) {
  let state = new Set([0]);
  state = nextStateSet(r, state, "^^");

  for (const char of str) {
    state = nextStateSet(r, state, char);
    if (state.size === 0) return false;
  }
  // 終了記号で遷移させると、終了してない状態が全部消える
  state = nextStateSet(r, state, "$$");
  return state.has(r.regex.length - 1);
}
