const astra = require('./data/astra');
const open = require("open");
const axios = require("axios");
const { format, add } = require("date-fns");
const notifier = require("node-notifier");
const player = require("play-sound");

const RATE_LIMIT = 1000 * 2;

function log(...msg) {
  console.log(new Date().toISOString(), ...msg);
}

function error(msg) {
  console.error(new Date().toISOString(), msg);
}

function updateLinkDate(link) {
  return link.replace(/\d{4}-\d{2}-\d{2}/, format(new Date(), "yyyy-MM-dd"));
}

function updateLinkDatePfizer(link) {
  return link.replace(
    /\d{4}-\d{2}-\d{2}/,
    format(add(new Date(), { days: 42 }), "yyyy-MM-dd")
  );
}

async function hasSuitableDate(data, xhrLink, secondShotXhrLink) {
  try {
    if (data?.total) {
      log("More than 0 availabilities");

      if (secondShotXhrLink) {
        const secondShotData = await axios.get(
          updateLinkDatePfizer(secondShotXhrLink)
        ).data;

        log("second shot data", secondShotData);

        return secondShotData.total !== 0;
      }
    }

    if (data?.next_slot?.startsWith("2021-05")) {
      const newData = (
        await axios.get(xhrLink.replace(/\d{4}-\d{2}-\d{2}/, data.next_slot))
      ).data;

      log("further checking for specific later date", xhrLink);

      for (availability of newData.availabilities) {
        if (availability.slots.length > 0) {
          log("More than one slot when requesting for new Date");
          return true;
        }
      }
    }

    if (data?.availabilities?.length) {
      for (availability of data.availabilities) {
        if (availability.slots.length > 0) {
          log("More than one slot");
          return true;
        }
      }
    }
  } catch (e) {
    throw e;
  }
  return false;
}

function notify() {
  console.log("\u0007");

  notifier.notify({
    title: "Vacination",
    message: "Appointment!",
  });

  player.play("./bell-ring-01.wav", function (err) {
    if (error) {
      error(err);
    }
  });
}

function observe(xhrLink, bookingLink, secondShotXhrLink) {
  const reschedule = (time) => {
    setTimeout(
      () => observe(xhrLink, bookingLink),
      Math.ceil(time || Math.random() * 1000)
    );
  };

  axios
    .get(updateLinkDate(xhrLink))
    .then(async function (response) {
      try {
        const isSuitable = await hasSuitableDate(
          response?.data,
          xhrLink,
          secondShotXhrLink
        );
        if (isSuitable) {
          log("direct success", response.data, bookingLink);

          open(bookingLink);

          notify();

          // 2 Minutes break
          reschedule(1000 * 60 * 2);

          return;
        }
      } catch (e) {
        error(e);
      }
      reschedule(RATE_LIMIT);
    })
    .catch(function (e) {
      error(e);
      reschedule(RATE_LIMIT);
    });
}

astra.DATA.forEach((links) => {
  observe(links.xhrLink, links.bookingLink);
});

console.log("Started checking periodically...");
console.log(
  "Just keep it running, it will play a sound and open a browser when an appointment opens up"
);
