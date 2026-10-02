package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Generates the existing match banner without a Node canvas dependency. */
@Service
public class VersusImageService {
    private final JsonSql json;
    private final Path media;
    private final Path background;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public VersusImageService(JsonSql json,@Value("${media.root:uploads}") String media,
            @Value("${media.versus-background:../migration-uidesign/backend/assets/VSPARATEAM.jpg}") String background) {
        this.json=json;this.media=Path.of(media).toAbsolutePath().normalize();this.background=Path.of(background);
    }
    public byte[] generate(int a,int b) {
        JsonNode left=team(a),right=team(b);
        BufferedImage image=new BufferedImage(1400,700,BufferedImage.TYPE_INT_RGB);
        Graphics2D g=image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            BufferedImage base=null;
            if (Files.isRegularFile(background)) base=ImageIO.read(background.toFile());
            if(base!=null) cover(g,base,0,0,1400,700);
            else { g.setPaint(new GradientPaint(0,0,new Color(8,17,31),1400,700,new Color(16,25,43)));g.fillRect(0,0,1400,700); }
            g.setPaint(new GradientPaint(0,0,new Color(30,70,160,90),590,0,new Color(30,70,160,0)));g.fillRect(0,120,590,410);
            g.setPaint(new GradientPaint(1400,0,new Color(175,40,40,90),810,0,new Color(175,40,40,0)));g.fillRect(810,120,590,410);
            logo(g,left,110,new Color(76,201,240),new Color(29,78,216));
            logo(g,right,1040,new Color(255,107,107),new Color(127,29,29));
            name(g,left.path("name").asText(),235);name(g,right.path("name").asText(),1165);
            g.setFont(new Font(Font.SANS_SERIF,Font.BOLD,14));g.setColor(new Color(255,255,255,140));g.drawString("GGL",1345,682);
            var out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);return out.toByteArray();
        } catch(Exception error) { throw new DraftHttpException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not generate match image."); }
        finally {g.dispose();}
    }
    private JsonNode team(int id) {
        return json.first("SELECT to_jsonb(t)::text FROM public.\"Team\" t WHERE id=?",id)
                .orElseThrow(()->new DraftHttpException(HttpStatus.NOT_FOUND,"Team not found."));
    }
    private void logo(Graphics2D g,JsonNode team,int x,Color accent,Color fallback) {
        g.setStroke(new BasicStroke(4));g.setColor(accent);g.drawRect(x-6,184,262,262);
        g.setPaint(new GradientPaint(x,190,fallback,x+250,440,new Color(15,23,42)));g.fillRect(x,190,250,250);
        BufferedImage logo=readLogo(team.path("logo").asText(""));
        if(logo!=null) {
            Shape original=g.getClip();g.clipRect(x,190,250,250);cover(g,logo,x,190,250,250);g.setClip(original);
        } else {
            String[] words=team.path("name").asText("?").strip().split("\\s+");
            String letters=words.length>1?words[0].substring(0,1)+words[1].substring(0,1):words[0].substring(0,Math.min(2,words[0].length()));
            g.setColor(Color.WHITE);g.setFont(new Font(Font.SANS_SERIF,Font.BOLD,88));
            center(g,letters.toUpperCase(),x+125,345);
        }
    }
    private BufferedImage readLogo(String value) {
        if(value.isBlank())return null;
        try {
            URI uri=URI.create(value);
            String path=uri.getPath();
            int uploads=path.indexOf("/uploads/");int assets=path.indexOf("/assets/");
            if(uploads>=0 || assets>=0) {
                String suffix=uploads>=0?path.substring(uploads+9):path.substring(assets+8);
                Path local=media.resolve(suffix).normalize();
                if(local.startsWith(media)&&Files.isRegularFile(local))return ImageIO.read(local.toFile());
            }
            if(!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme()))return null;
            var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(4)).GET().build();
            var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());
            try(var stream=response.body()) {
                if(response.statusCode()!=200)return null;
                byte[] bytes=stream.readNBytes(10*1024*1024+1);
                if(bytes.length>10*1024*1024)return null;
                return ImageIO.read(new ByteArrayInputStream(bytes));
            }
        } catch(Exception ignored) {return null;}
    }
    private static void name(Graphics2D g,String value,int x) {
        int size=36;g.setFont(new Font(Font.SANS_SERIF,Font.BOLD,size));
        while(g.getFontMetrics().stringWidth(value)>420 && size>14)g.setFont(new Font(Font.SANS_SERIF,Font.BOLD,--size));
        g.setColor(Color.WHITE);center(g,value,x,505);
    }
    private static void center(Graphics2D g,String text,int x,int y) {g.drawString(text,x-g.getFontMetrics().stringWidth(text)/2,y);}
    private static void cover(Graphics2D g,BufferedImage image,int x,int y,int w,int h) {
        double scale=Math.max((double)w/image.getWidth(),(double)h/image.getHeight());
        int width=(int)Math.ceil(image.getWidth()*scale),height=(int)Math.ceil(image.getHeight()*scale);
        g.drawImage(image,x+(w-width)/2,y+(h-height)/2,width,height,null);
    }
}
