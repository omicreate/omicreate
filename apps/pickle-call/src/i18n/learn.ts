// learn の言葉（担当の画面だけが使う）。日本語が正本で、英語は同じキーをすべて持つ。
const ja = {} as const

const en: Record<keyof typeof ja, string> = {}

export default { ja, en }
