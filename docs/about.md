# Why
There is a lot of cool tools for path of exile, but it just struck me that in terms of trade u dont really have any tool for Selling stuff. There is ofc Better trading extension, but thats still confined to trade website itself. So i just wanted to make an app that provides better trading expirience.
# who am i?
Computer engenering student from poland.
# Credibility
This is not my first project, i already have [cslol-go](https://github.com/Aurecueil/Cs-lol-go) which is a mod manager for league of legends. I made it over year ago and i still meintain it. (altho i lazied on improvments and new features i kept it running and fixed any critical issue asap)

Repository has 59 stars as of now, app is used by about 2000 users (based on release downloads), and peak downloads is 11k for version [0.2.4](https://github.com/Aurecueil/Cs-lol-go/releases/tag/0.2.4)

Currently app is down, but as much as id like it resolved now, i need to wait, as issue is related to critical dependancy. If ure intrested in details, feel free to ask me about it on my discord. https://discord.gg/bNfbQHrCgf
# Meintanance
When building Path of Building i took relatively flexible approach, which means app needs only minimal amount of meintanance eavh league.

As example changes introduced in Allflame would need following meintanance:
- add intangibility/sulfur as viabale sort options
- grant instangibility styled frame (visual only)
- update supporter pack banner (visual only)

Ofc some patches might need more meintanance, such as adding display for new mod types (eg. builtinsupport from mirage) or new features akin to hide bonded.
# Currency Exchange data HOW
poe.ninja data is NOT used. for two reasons:
- to not put stress on poe.ninja service (altho having job that takes data from it and put on my server would not be too bad)
- more data. having own collection allows me to also collect data for: 
  - buy/sell offers on top of traded volume data
  - data from ruthless leagues as well as xbox and sony
  
Data is pulled from ggg public api everyhour as ggg releases it. Data is stripped to only trade league and trade-viable currencies, processed and uploaded r2 storage. storage is public and freely accesible, if anybody wnats to use it, let me know, ill make simple doc.
# Ai
I do use ai, effectively everybody does and there is no reason not to do so.
Ofc, me just using ai doesnt mean there is no effort put into the app nor that i just brute force everything with AI.
### what ai do i use?
- claude free
- gemini pro (gemini pro + youtube premium for $10 student discount pack)