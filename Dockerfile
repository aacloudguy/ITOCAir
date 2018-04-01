# Format: FROM    repository[:version]
FROM       ubuntu:latest

# Format: MAINTAINER Name <email@addr.ess>
MAINTAINER Yang Lei <yanglei@us.ibm.com>

# Installation:

# Update apt-get sources AND install NodeJS and npm
RUN apt-get update && apt-get install -y nodejs && apt-get install -y npm 

# The real logic

ADD ./ /var/apps/ITOCair-nodejs

RUN \
  rm -fr /var/apps/ITOCair-nodejs/.git ;\
  cd /var/apps/ITOCair-nodejs ;\
  npm install;\
  chmod +x run.sh


WORKDIR /var/apps/ITOCair-nodejs

EXPOSE 9080 9443

ENV APP_NAME app.js

# Use the following to indicate authentication micro-service location: host:port
#ENV AUTH_SERVICE

# Use the following environment variable to define datasource location
#ENV MONGO_URL mongodb://localhost:27017/ITOCair
#ENV CLOUDANT_URL


CMD ["./run.sh"]
