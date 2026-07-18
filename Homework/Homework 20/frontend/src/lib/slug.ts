/**
 * Each quiz topic is "written" in the language its real-world lore is most
 * tied to, instead of a generic ".ts" for everything.
 */
const TOPIC_EXTENSIONS: Record<string, string> = {
  "Data Structures": "rs", // Rust's borrow checker made building linked structures a legend of its own
  Algorithms: "cpp", // the default weapon of competitive programming
  "Operating Systems": "c", // Unix was built in C, and C was built to build Unix
  "Computer Networks": "go", // designed at Google for concurrent, networked services
  Databases: "sql", // no lore needed, this one just is the language
  "Programming Languages": "lisp", // the language paradigm-hoppers use to study language itself
  "Web Development": "js", // the only language that runs natively in every browser
  "Computer Architecture": "asm", // registers, opcodes, bare metal
  Cybersecurity: "sh", // getting a shell is the whole point
  "Artificial Intelligence": "py", // numpy, PyTorch, TensorFlow: the modern lingua franca of ML
  "Design Patterns": "java", // the Gang of Four's spiritual home turf
  "Distributed Systems": "erl", // Erlang was born at Ericsson to keep telecom switches alive
};

const DEFAULT_EXTENSION = "ts";

/** Turns a quiz topic into a source-file-looking name, e.g. "Artificial Intelligence" -> "artificial_intelligence.py". */
export function toFilename(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const extension = TOPIC_EXTENSIONS[topic] ?? DEFAULT_EXTENSION;
  return `${slug}.${extension}`;
}
