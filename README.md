# Corporacer

A top-down arcade sprint through an office campus. Race 3 km straight up Innovation Avenue to HQ while cones, road works, coffee spills, runaway office chairs, delivery vans, printers and boxes of Q3 files block the road. Race AI colleagues from Finance, Legal and IT, chase your best time in time trial, or race up to three real colleagues on their own devices.

## Play

```bash
npm start
```

Open `http://localhost:3000`. Solo modes also work by opening `index.html` directly in a browser.

To race colleagues on the same Wi-Fi, they open your computer's local-network address (for example `http://192.168.1.20:3000`). To race across the internet, deploy this folder to any Node.js host with a public HTTPS URL and share that. Rooms live in server memory. Set `PORT` if your host requires it.

## Modes

- **Start race**: you line up against three AI drivers. Rival pace (Intern, Manager, Executive) sets how fast they are.
- **Daily trial**: just you and the clock on a course that stays the same all day. Your best run is saved as a ghost car you race against, and the HUD shows how far ahead or behind it you are. Races against the AI get a fresh layout every time.
- **Team race**: one person creates a room and shares the 6-letter code or invite link. 2–4 drivers join, everyone marks ready, and the race starts. Everyone in a room gets the same obstacle layout.

## Controls

| Keys | Action |
| --- | --- |
| W / ↑ | Accelerate |
| A D / ← → | Steer |
| S / ↓ | Brake, then reverse |
| Space | Drift (sliding refills nitro) |
| Shift | Nitro (blue cans refill it) |
| Esc / P | Pause (solo modes) |
| M | Sound on/off |

On phones and tablets, on-screen buttons appear and the car accelerates by itself.

## Rules

Solid obstacles (boxes, printers, water coolers, road-works barriers, vans) stop you hard. Cones and office chairs get knocked away but still slow you down. Coffee spills spin you out. Every hit counts as an incident on your race review. Skim past a hazard at speed without touching it for a close call: it refills some nitro, and chaining close calls builds a combo. The shoulder slows you and the concrete walls bounce you back. Blue chevron pads give a free boost. Obstacles get denser the closer you get to HQ, across five zones: Morning Commute, Construction Zone (road works and cones), Coffee Run (spills, coolers, chairs), Delivery Hour (vans and boxes) and Final Deadline (everything).
