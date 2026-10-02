package com.overtimeproductions.goonginga.announcements;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class AnnouncementTemplates {
    private static final Set<String> TYPES=Set.of("TOURNAMENT","MINIGAME","CUSTOM","FORM");
    public String type(String input) {
        String type=input==null?"":input.trim().toUpperCase();
        if (!TYPES.contains(type)) throw new IllegalArgumentException("Choose Tournament, Minigame, Custom or Form.");
        return type;
    }
    public Map<String,Object> validate(String type,Object raw) {
        if (!(raw instanceof Map<?,?> values)) throw new IllegalArgumentException("Announcement content must be an object.");
        var result=new LinkedHashMap<String,Object>();
        switch (type) {
            case "CUSTOM" -> {
                result.put("eyebrow",text(values.get("eyebrow"),60,false,"Eyebrow"));
                result.put("headline",text(values.get("headline"),120,true,"Headline"));
                result.put("body",text(values.get("body"),600,false,"Body"));
                result.put("imageUrl",link(values.get("imageUrl"),"Image URL"));
                result.put("ctaLabel",text(values.get("ctaLabel"),40,false,"Button label"));
                result.put("ctaHref",link(values.get("ctaHref"),"Button link"));
            }
            case "FORM" -> {
                result.put("headline",text(values.get("headline"),120,true,"Headline"));
                result.put("body",text(values.get("body"),600,false,"Body"));
                String formUrl=link(values.get("formUrl"),"Form URL");
                if (formUrl.isBlank()) throw new IllegalArgumentException("Form URL is required.");
                result.put("formUrl",formUrl);
                result.put("ctaLabel",text(values.get("ctaLabel"),40,false,"Button label"));
            }
            case "MINIGAME" -> {
                String slug=text(values.get("minigameSlug"),120,true,"Minigame");
                if (!slug.matches("(?i)^[a-z0-9][a-z0-9-]*$")) throw new IllegalArgumentException("That minigame route is not valid.");
                result.put("minigameSlug",slug);
                result.put("ctaLabel",text(values.get("ctaLabel"),40,false,"Button label"));
            }
            case "TOURNAMENT" -> {
                Object match=values.get("matchId");
                if (match==null || "".equals(match)) result.put("matchId",null);
                else {
                    try { int id=Integer.parseInt(String.valueOf(match)); if (id<1) throw new NumberFormatException(); result.put("matchId",id); }
                    catch (NumberFormatException error) { throw new IllegalArgumentException("Pick a valid match, or leave the announcement on automatic."); }
                }
                result.put("headline",text(values.get("headline"),120,false,"Headline"));
            }
            default -> throw new IllegalArgumentException("Unknown announcement template.");
        }
        return result;
    }
    private static String text(Object value,int max,boolean required,String label) {
        if (value==null) {
            if (required) throw new IllegalArgumentException(label+" is required.");
            return "";
        }
        if (!(value instanceof String string)) throw new IllegalArgumentException("Text fields must be plain text.");
        String result=string.trim();
        if (result.length()>max) result=result.substring(0,max);
        if (required && result.isBlank()) throw new IllegalArgumentException(label+" is required.");
        return result;
    }
    private static String link(Object value,String label) {
        String text=text(value,500,false,label);
        if (text.isBlank()) return "";
        if (text.chars().anyMatch(ch -> ch=='\\' || ch<' ')) throw new IllegalArgumentException(label+" must be an internal path or an http(s) URL.");
        try {
            URI uri=URI.create(text);
            if (text.startsWith("/") && !text.startsWith("//") && uri.getHost()==null) return text;
            if (("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) && uri.getHost()!=null) return text;
        } catch (RuntimeException ignored) { }
        throw new IllegalArgumentException(label+" must be an internal path or an http(s) URL.");
    }
}
