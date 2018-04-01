## ITOCair NodeJS on Docker 


Assume you have [installed Docker and stared Docker daemon](https://docs.docker.com/installation/)

### Run MongoDB container

	docker run --name mongo_001 -d -P mongo
	
	docker ps
		to get mapped port of 27017, e.g. 49177 

### Create a docker image for ITOCair and run ITOCair container

	docker build -t ITOCair/web .
	

#### Run ITOCair Container in Monolithic

	docker run -d -P --name ITOCair_web_001 --link mongo_001:mongo ITOCair/web 
	
	or use the MONGO_URL location e.g.
	
	docker run -d -P --name ITOCair_web_002 -e MONGO_URL=mongodb://192.168.59.103:49177/ITOCair ITOCair/web 
	
		
#### Run ITOCair Containers in Micro-Service

	docker run -d -P --name ITOCair_web_003 -e APP_NAME=authservice_app.js --link mongo_001:mongo ITOCair/web 
	
	docker ps
		to get mapped port for 9443 , e.g. 49187
		
	docker run -d -P --name ITOCair_web_004 -e AUTH_SERVICE=192.168.59.103:49187 --link mongo_001:mongo ITOCair/web 

	You can also use the MONGO_URL location as Monolithic case


#### Run ITOCair Containers in Micro-Service with Netflix Hystrix Stream enabled

	docker run -d -P --name ITOCair_web_005 -e APP_NAME=authservice_app.js --link mongo_001:mongo ITOCair/web 
	
	docker ps
		to get mapped port for 9443 , e.g. 49187
		
	docker run -d -P --name ITOCair_web_006 -e AUTH_SERVICE=192.168.59.103:49187 -e enableHystrix=true --link mongo_001:mongo ITOCair/web 
	
	You can also use the MONGO_URL location as Monolithic case
	

#### Get application port

	docker ps
		get the mapped port for 9080 to get the application url. e.g. http://192.168.59.103:49178

	If hystrix is enabled, it is available at : http://192.168.59.103:49178/rest/api/hystrix.stream

	
#### Note:

* For Cloudant, you can use CLOUDANT_URL for datasource location


## Run Jmeter workload on Docker 

### Create a docker image for Jmeter workload

	docker build -t ITOCair/workload document/workload

### Run Jmeter workload against ITOC Air runtime

	docker run -i -t -e APP_PORT_9080_TCP_ADDR=<the ip> -e APP_PORT_9080_TCP_PORT=<the port> ITOCair/workload
	
	or
	
	docker run -i -t --link ITOCair_web_001:app ITOCair/workload
	
