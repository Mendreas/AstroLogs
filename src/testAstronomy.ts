import { Body, Observer, Equator, Horizon } from "astronomy-engine";

const observer = new Observer(38.7223, -9.1393, 0);
const now = new Date();
const eq = Equator(Body.Jupiter, now, observer, true, true);
const hor = Horizon(now, observer, eq.ra, eq.dec, "normal");
console.log("Jupiter Altitude:", hor.altitude);