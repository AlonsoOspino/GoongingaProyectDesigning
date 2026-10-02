package com.overtimeproductions.goonginga.common.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.nio.file.Path;

@Configuration
public class MediaConfiguration implements WebMvcConfigurer {
    @Value("${media.root:uploads}") private String mediaRoot;
    @Value("${media.bundled-maps:assets/maps}") private String bundledMaps;
    @Value("${media.bundled-heroes:assets/heroes}") private String bundledHeroes;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry handlers) {
        handlers.addResourceHandler("/uploads/**").addResourceLocations(location(mediaRoot));
        handlers.addResourceHandler("/assets/maps/**")
                .addResourceLocations(location(Path.of(mediaRoot).resolve("maps").toString()), location(bundledMaps));
        handlers.addResourceHandler("/assets/heroes/**")
                .addResourceLocations(location(Path.of(mediaRoot).resolve("heroes").toString()), location(bundledHeroes));
        handlers.addResourceHandler("/assets/hero-gifts/**")
                .addResourceLocations(location(Path.of(mediaRoot).resolve("hero-gifts").toString()));
    }

    private static String location(String path) { return Path.of(path).toAbsolutePath().normalize().toUri() + "/"; }
}
