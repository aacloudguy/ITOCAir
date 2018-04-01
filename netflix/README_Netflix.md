The following describes how to use Netflix OSS technology to interact with a "micro-service", AuthurizationService , for session creation, session validation, session invalidation.

The work has only been verified outside bluemix.

Assumption: 

	Already started eureka server ( default to localhost:8080)
	Already registered the "micro-service" ITOCAIR-AUTH-Service with eureka server . There are two ways:
	1. cd netflix/authservice
	   npm install
	   node app.js
	or 2. start the Java AuthService. (https://svn.opensource.ibm.com/svn/scale/temp-projects/ITOCair-cloudoe-netflix)

	For monitoring using Hystrix and Turbine

		Started hystrix at: http://localhost:7979/hystrix-dashboard (using ..\gradlew jettyRun)
		Started hystrix at: http://localhost:8080/turbine-web ( as a war)

		Add your edge application url to hystrix-dashboard:
				http://localhost:9980/ITOCair-webapp/hystrix.stream ( the java version)
				http://localhost:9080/rest/api/hystrix.stream ( the nodejs version)
				http://localhost:8080/turbine-web/turbine.stream?cluster=default (turbine already configured with discovery of ITOCair)


	please refer to the follow for details on how to setup the remote micro service (written in java)
		svn co https://svn.opensource.ibm.com/svn/scale/temp-projects/ITOCair-cloudoe-netflix


NodeJS and NetflixOSS.

	You can choose between Java v.s. Http approach by "set authService=ITOCaircmd" or "set authService=ITOCairhttp" 
	
	npm install 
		will install all things except node-java, which is only needed by "authService=ITOCaircmd" 
		
	node app.js

Java Approach:
--------------------

set authService=ITOCaircmd

1. Use node-java

	npm install java@0.2.5 ( the latest 0.4.2 has issue)

	When running on windows, depends on: 1) install Visual Studio 2012 Express for Windows Desktop - English,   
										 2) set JAVA_HOME 
										 3) set PATH to include: %JAVA_HOME%\jre\bin\default
										 4) python 2.7


2. Prepare external dependencies due to Netflix OSS. (all jars under ext-lib)

ITOCair-common-1.0-SNAPSHOT.jar
	contains the ITOCair entity model. Built from ITOCair java version

ITOCairHystrixCmd.jar
	contains the hystrix command to interact with authorization micro-service. Extracted from ITOCair java version
	
ITOCairHystrixCmdUtil-1.0-SNAPSHOT.jar 
	contains the code for the following:
		Bootstrap using KaryonServer and shutdown
		Simplify hystrix command call from nodejs on createSession/validateSession/invalidateSession by wrapping in a util class
		Hystrix stream implementation
		HealthCheck class.
		
	the source code is under ITOCairHystrixCmdUtil, use "mvn clean compare package" to build.
		you need to install the 2 jars if they are not previously built/installed
		
		mvn install:install-file -Dfile=ITOCairHystrixCmd.jar -DgroupId=com.ITOCair -DartifactId=ITOCairHystrixCmd -Dversion=1.0-SNAPSHOT -Dpackaging=jar
		mvn install:install-file -Dfile=ITOCair-common-1.0-SNAPSHOT.jar -DgroupId=com.ITOCair -DartifactId=ITOCair-common -Dversion=1.0-SNAPSHOT -Dpackaging=jar
		
	During the build, all dependent jars ( including the above 2) will be copied under ext-lib/target/lib and used by runtime. 
		You will need to copy the built ITOCairHystrixCmdUtil-1.0-SNAPSHOT.jar to replace the current one.
	
	If you do not want to build above, you can also issue mvn package from netfix/ext-lib , which will gerenate the dependent jars w/o the above 2 under target/lib

3. ITOCaircmd\index.js contains the authorization code 

	Verified the following works: 
		1) eureka server registry, 
		2) heart-beat, 
		3) karyon health check
		4) ribbon http with round robin load balancing
		5) hystrix command with circuit breaker
		6) hystrix dashboard with application hystrix stream and aggregated turbine stream

4. Some thoughts on CF 

	Dependencies on JAVA_HOME

5. Code reuse with Java version ITOCair thoughts

	New bootstrapping code is created from the one in ITOCair Java project as we need to remove dependencies to HTTP


Http Approach:
----------------------------

set authService=ITOCairhttp

1. Use stats-lite for metrix (percentile)

	npm install stats-lite

2. Use circuit-breaker for fail fast

	npm install circuit-breaker
		
3. ITOCairhttp\index.js contains the authorization code 

	Verified 1) eureka server registry, 
		     2) heart-beat, 
		     3) health check
		     4) round robin load balancing, 
		     5) hystrix dashboard with application hystrix stream and aggregated turbine stream
			 6) fail fast with circuit breaker and integration with hystrix stream


==================================================================================================================

To run the application on docker for HTTP approach

1. setup docker sever on ubuntu ( The same as in root README)

http://docs.docker.com/installation/ubuntulinux/

2.  git clone the project onto the docker server and change to the project root directory ( The same as root README)

3.  Create a docker image for mongodb from Dockerfile: ITOCair/db  ( The same as root README)
   	build: docker build -t ITOCair/db document/Dockerfile/mongodb
	run: docker run --name mongo_001 -d -P ITOCair/db
	check log:  docker logs mongo_001
	verify :
		get the mapped port:  docker ps
		mongo -port < the above port>

4. Create a docker image for nodejs edge service  from Dockerfile, "ITOCair/nodejs" ( The same as root README)
	build: docker build -t ITOCair/nodejs document/Dockerfile/nodejs 
	verify:  docker run -i -t ITOCair/nodejs /bin/bash


5. Create a docker image and container for Eureka from Dockerfile, "ITOCair/eureka" | ITOCair_eureka_001
	build: docker build -t ITOCair/tomcat7 document/Dockerfile/tomcat
		verify :  docker run -i -t ITOCair/tomcat7 /bin/bash
	docker build -t ITOCair/git_gradle document/Dockerfile/git_gradle
		verify :  docker run -i -t ITOCair/git_gradle /bin/bash
	docker build -t ITOCair/eureka document/Dockerfile/eureka
		verify :  docker run -i -t ITOCair/eureka /bin/bash
	run :  docker run -d -P --name ITOCair_eureka_001 ITOCair/eureka

		Eureka console at : http://<eureka server ip>:<application mapped port>/eureka

6. Create docker image and container for ITOCair edge v.s. micro service 
	build: docker build -t ITOCair/web .	( The same as root README)
		verify :  docker run -i -t ITOCair/web /bin/bash
	run:   docker run -d -P -e "authService=ITOCairhttp" --name ITOCair_web_edge_001 --link mongo_001:db --link ITOCair_eureka_001:eureka ITOCair/web

	docker build -t ITOCair/authservice netflix/authservice
	run:   docker run -d -P --name ITOCair_authservice_001 --link mongo_001:db --link ITOCair_eureka_001:eureka ITOCair/authservice

7. Run the application!
	http://<docker server ip>:<application mapped port>

