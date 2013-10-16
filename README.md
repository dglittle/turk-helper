UNDER CONSTRUCTION - DOESN'T WORK YET
=====================================


turk-helper
===========

for posting stuff on turk and such

commands to set it up on heroku:

```
heroku apps:create turk-helper
heroku addons:add mongohq:sandbox

heroku config:set HOST=https://turk-helper.herokuapp.com
heroku config:set SESSION_SECRET=change_me

git push heroku master
```
