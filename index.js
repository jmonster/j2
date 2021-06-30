import fetch from "node-fetch";
import queue from "queue";
import blacklist from "./blacklist.js";

const q = queue({ concurrency: 1, results: [] });
const TWIT_REGEX = /window.INITIAL_STATE(.*?};)/s;
const excluded = blacklist();

async function symbols() {
  const ticks = await fetch("https://www.sec.gov/include/ticker.txt");
  const text = await ticks.text();
  const lines = text.split("\n");
  const symbols = lines.map((l) => l.split("\t")[0].toUpperCase());
  const valid = symbols.filter((s) => !excluded.has(s));

  return valid;
}

async function getTwit(s) {
  return await fetch(`https://stocktwits.com/symbol/${s}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
}

function scrapeTwit(page) {
  const regex = /<script.*>((.|\n)*?)<\/script>/gim;
  const match = page.match(regex);
  const initialStateString = match.find((i) => i.indexOf("INITIAL_STATE") > -1);
  const [variable] = initialStateString.match(TWIT_REGEX);
  const cleansed = variable
    .replace("window.INITIAL_STATE = ", "")
    .replace(/;$/, "");

  const objectified = JSON.parse(cleansed);
  const inventory = objectified.stocks.inventory;

  let interestingData;
  for (const prop in inventory) {
    const { trendingScore, sentimentChange, volumeChange, quote } =
      inventory[prop];
    interestingData = { trendingScore, sentimentChange, volumeChange, quote };
    break;
  }

  return interestingData;
}

q.on("success", ([symbol, status]) => {
  console.log(symbol, status);
});

(async function foo() {
  const set = await symbols();
  set.forEach((s) => {
    q.push(function () {
      return new Promise(async (resolve, reject) => {
        const twit = await getTwit(s);
        try {
          const data = scrapeTwit(await twit.text());
          console.log(data);
        } catch (err) {
          console.error(err);
        }

        resolve([s, twit.status]);
      });
    });
  });

  q.start(function (err) {
    if (err) throw err;
    console.log("all done:", q.results);
  });
})();
