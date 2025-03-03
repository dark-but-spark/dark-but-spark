// package com.example.boxgame;

import java.util.LinkedList;
import java.util.Queue;

public class Helper {
    public static String output = "";

    private static int N;
    private static int M;
    static char[][] mp = new char[10][10];
    // 人和箱子的初始位置
    private static int sx;
    private static int sy;
    private static int bx;
    private static int by;

    private static final int[][] dir = {{-1, 0}, {1, 0}, {0, 1}, {0, -1}};
    private static final char[] dpathB = new char[]{'N', 'S', 'E', 'W'};
    private static final char[] dpathP = new char[]{'n', 's', 'e', 'w'};
    private static String ans;

    public static String cal(String input) {
        output = "";
        String[] line = input.split("\n");
        String[] words = line[0].split(" ");
        N = Integer.parseInt(words[0]);
        M = Integer.parseInt(words[1]);
        for (int i = 0; i < N; i++) {
            String mapLine = line[i + 1];
            for (int j = 0; j < mapLine.length(); j++) {
                mp[i][j] = mapLine.charAt(j);
                if (mp[i][j] == 'P') {
                    sx = i;
                    sy = j;
                }

                if (mp[i][j] == 'B') {
                    bx = i;
                    by = j;
                }
            }
        }
        if (bfs()) {
            output += ans;
        }else {
            output += "Impossible";
        }
        return output;
    }

    static boolean check(int x, int y) {
        if (x < 0 || x >= N || y < 0 || y >= M) {
            return false;
        }
        if (mp[x][y] == '#') {
            return false;
        }
        return true;
    }

    static boolean bfs() {
        int[][] vis = new int[25][25];
        vis[bx][by] = 1;
        Queue<node> q = new LinkedList<>(); // 创建一个普通队列(先进先出)
        q.add(new node(sx, sy, bx, by, ""));
        while (!q.isEmpty()) {
            node now = q.peek();
            q.poll();
            for (int i = 0; i < 4; i++) {
                // 箱子的新位置
                int nbx = now.bx + dir[i][0];
                int nby = now.by + dir[i][1];
                // 箱子的前一个位置,人必须能到达这个位置
                int tx = now.bx - dir[i][0];
                int ty = now.by - dir[i][1];
                String path = "";
                StringBuilder pathBuilder = new StringBuilder(path);
                if (check(nbx, nby) && check(tx, ty) && vis[nbx][nby] == 0) {
                    if (bfs2(now.px, now.py, now.bx, now.by, tx, ty, pathBuilder)) {
                        if (mp[nbx][nby] == 'T') {
                            ans = now.path + path + dpathB[i];
                            return true;
                        }
                        vis[nbx][nby] = 1;
                        q.add(new node(now.bx, now.by, nbx, nby, now.path + pathBuilder.toString() + dpathB[i]));
                    }
                }
            }
        }
        return false;
    }

    static boolean bfs2(int ppx, int ppy, int bbx, int bby, int tx, int ty, StringBuilder pathBuilder) {
        // 局部标识数组，不要定义全局
        int[][] vis = new int[25][25];
        vis[ppx][ppy] = 1; // 人的位置
        vis[bbx][bby] = 1; // 箱子的位置
        Queue<person> Q = new LinkedList<>(); // 创建一个普通队列(先进先出)
        Q.add(new person(ppx, ppy, ""));
        while (!Q.isEmpty()) {
            person now = Q.peek();
            Q.poll();
            if (now.x == tx && now.y == ty) { // 目标位置，即箱子的前一个位置
                pathBuilder.append(now.path);
                return true;
            }
            for (int i = 0; i < 4; i++) {
                // 人的新位置
                int npx = now.x + dir[i][0];
                int npy = now.y + dir[i][1];
                if (check(npx, npy) && vis[npx][npy] == 0) {
                    vis[npx][npy] = 1;
                    Q.add(new person(npx, npy, now.path + dpathP[i]));
                }
            }
        }
        return false;
    }
}

class person {
    int x;
    int y;
    String path;

    person(int x_, int y_, String path_) {
        x = x_;
        y = y_;
        path = path_;
    }
}

class node {
    int px, py, bx, by;
    String path;


    node(int px_, int py_, int bx_, int by_, String path_) {
        px = px_;
        py = py_;
        bx = bx_;
        by = by_;
        path = path_;
    }
}
