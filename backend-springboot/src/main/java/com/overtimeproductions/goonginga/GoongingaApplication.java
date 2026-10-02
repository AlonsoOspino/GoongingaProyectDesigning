package com.overtimeproductions.goonginga;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GoongingaApplication {

	public static void main(String[] args) {
		var context=SpringApplication.run(GoongingaApplication.class, args);
		if(!"off".equals(context.getEnvironment().getProperty("migration.mode","off")))
			System.exit(SpringApplication.exit(context,()->0));
	}

}
