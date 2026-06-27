export async function getRandomFact(req, res) {
  try {
    const response = await fetch(
      "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch fact");
    }

    const data = await response.json();
    return res.status(200).json({ fact: data.text });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch random fact" });
  }
}
